// Coin Ledger as an Android app (and the same page on the web): sign-in and sync through your own
// Firebase project, slab labels read on the phone, invoices read by Claude with your API key,
// exports through the phone's share sheet.
(function appPlatform() {
  "use strict";
  const capx = window.capacitorExports;
  const isNative = !!(capx && capx.Capacitor && typeof capx.Capacitor.isNativePlatform === "function" && capx.Capacitor.isNativePlatform());
  const Vision = isNative ? capx.registerPlugin("LedgerVision") : null;
  const Filesystem = isNative ? capx.registerPlugin("Filesystem") : null;
  const Share = isNative ? capx.registerPlugin("Share") : null;
  const AppPlugin = isNative ? capx.registerPlugin("App") : null;
  const LabelParse = typeof labelParseModule === "function" ? labelParseModule() : null;
  const Store = window.LedgerStore, Reader = window.LedgerReader;
  const VERSION = (window.LEDGER_CONFIG && window.LEDGER_CONFIG.version) || "dev";
  const COLS = ["coins", "subs", "expenses", "accounts", "moves"];
  const byId = (id) => document.getElementById(id);

  /* ---------- reading slab labels on the phone (the same reader as Slab Plates) ---------- */
  function loadImage(file) {
    return new Promise((res, rej) => {
      const u = URL.createObjectURL(file), im = new Image();
      im.onload = () => { URL.revokeObjectURL(u); res(im); };
      im.onerror = () => { URL.revokeObjectURL(u); rej(new Error("decode")); };
      im.src = u;
    });
  }
  // Join pieces that sit on the same row, left to right, so "CAN 1950 $1 MS66" stays one line.
  function rowsOf(lines) {
    const ls = lines.filter((l) => l.text.trim()).sort((p, q) => (p.y + p.h / 2) - (q.y + q.h / 2));
    const rows = [];
    for (const l of ls) {
      const cy = l.y + l.h / 2, last = rows[rows.length - 1];
      if (last && Math.abs(last.cy - cy) < Math.min(last.h, l.h) * 0.5) last.items.push(l);
      else rows.push({ cy, h: l.h, items: [l] });
    }
    return rows.map((r) => r.items.sort((p, q) => p.x - q.x).map((i) => i.text).join(" "));
  }
  async function readLabel(file) {
    if (!Vision || !LabelParse) return null;
    const im = await loadImage(file);
    const k = Math.min(1, 2000 / Math.max(im.naturalWidth, im.naturalHeight));
    const cv = document.createElement("canvas");
    cv.width = Math.max(1, Math.round(im.naturalWidth * k)); cv.height = Math.max(1, Math.round(im.naturalHeight * k));
    cv.getContext("2d").drawImage(im, 0, 0, cv.width, cv.height);
    const image = cv.toDataURL("image/jpeg", 0.92);
    const res = await Vision.readText({ image });
    const lines = ((res && res.lines) || []).map((l) => ({ text: String(l.text || ""), x: l.x || 0, y: l.y || 0, w: l.w || 0, h: l.h || 0 }));
    if (!lines.length) return null;
    const d = LabelParse.parse(rowsOf(lines));
    // PCGS and NGC barcodes carry the cert number; use it when the printed one wasn't readable
    if (!d.cert && d.service !== "ICCS") {
      try {
        const codes = await Vision.readBarcodes({ image });
        const v = ((codes && codes.barcodes) || []).map((b) => String(b.value || "").replace(/\D/g, "")).find((x) => x.length >= 7 && x.length <= 10);
        if (v) d.cert = v;
      } catch (e) { /* no barcode */ }
    }
    const found = ["date", "denomination", "grade", "cert"].filter((key) => d[key]).length;
    if (!found) return null;
    const iccs = d.service === "ICCS";
    return {
      found,
      label: {
        name: [d.date, d.denomination].filter(Boolean).join(" "),
        grader: d.service || "", grade: d.grade || "", cert: d.cert || "",
        // ICCS prints its comments in their own box; on other labels the leftover lines are the variety
        variety: iccs ? "" : (d.variety || ""), comments: iccs ? (d.variety || "") : ""
      }
    };
  }

  /* ---------- exports: the share sheet on the phone, a download on a computer ---------- */
  const exporter = {
    async save({ filename, data }) {
      if (isNative) {
        const r = await Filesystem.writeFile({ path: filename, data: String(data), directory: "CACHE", encoding: "utf8" });
        try { await Share.share({ title: filename, url: r.uri, dialogTitle: "Save or send " + filename }); }
        catch (e) { throw { code: /cancel/i.test(String((e && e.message) || e)) ? "declined" : "unavailable" }; }
        return { status: "saved" };
      }
      const blob = data instanceof Blob ? data : new Blob([data], { type: /\.json$/.test(filename) ? "application/json" : "text/csv" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob); a.download = filename;
      document.body.appendChild(a); a.click();
      setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
      return { status: "saved" };
    }
  };

  /* ---------- sign-in ---------- */
  function authError(e) {
    switch (e && e.code) {
      case "invalid-credential": case "invalid-login-credentials": case "wrong-password": case "user-not-found":
        return "That email and password don't match. Try again, or tap Forgot password.";
      case "email-already-in-use": return "There's already an account with that email. Sign in instead.";
      case "weak-password": return "Use a password with at least 6 characters.";
      case "invalid-email": return "That email address doesn't look right.";
      case "missing-password": return "Enter your password.";
      case "network-request-failed": return "No internet connection. Connect and try again.";
      case "too-many-requests": return "Too many tries. Wait a few minutes, then try again.";
      case "operation-not-allowed": return "Email sign-in isn't turned on in your Firebase project yet. See SETUP.md.";
      default: return "Couldn't sign in: " + ((e && e.message) || "unknown error");
    }
  }
  function authUI() {
    let mode = "in";
    const msg = (t, ok) => { const m = byId("auth-msg"); m.textContent = t || ""; m.hidden = !t; m.classList.toggle("ok", !!ok); };
    const setMode = (m) => {
      mode = m;
      byId("auth-go").textContent = m === "in" ? "Sign in" : "Create account";
      byId("auth-mode").textContent = m === "in" ? "Create an account" : "I already have an account";
      byId("a-pass").setAttribute("autocomplete", m === "in" ? "current-password" : "new-password");
      byId("auth-sub").textContent = m === "in"
        ? "Sign in to your ledger. It stays in sync between this phone and your computer."
        : "Create the account your ledger is kept under. Use the same email and password on your phone and computer.";
      msg("");
    };
    byId("auth-version").textContent = "Version " + VERSION;
    if (!Store || !Store.configured) {
      byId("auth-noconfig").hidden = false; byId("auth-form").hidden = true; document.querySelector(".auth-links").hidden = true;
      return;
    }
    byId("auth-mode").addEventListener("click", () => setMode(mode === "in" ? "up" : "in"));
    byId("auth-reset").addEventListener("click", async () => {
      const email = byId("a-email").value.trim();
      if (!email) { msg("Enter your email first, then tap Forgot password."); byId("a-email").focus(); return; }
      try { await Store.reset(email); msg("Check your email for a link to set a new password.", true); }
      catch (e) { msg(authError(e)); }
    });
    byId("auth-form").addEventListener("submit", async (ev) => {
      ev.preventDefault();
      const email = byId("a-email").value.trim(), pass = byId("a-pass").value;
      if (!email || !pass) { msg("Enter your email and password."); return; }
      const b = byId("auth-go"); b.disabled = true; msg("");
      try { if (mode === "in") await Store.signIn(email, pass); else await Store.signUp(email, pass); byId("a-pass").value = ""; }
      catch (e) { msg(authError(e)); }
      finally { b.disabled = false; }
    });
    setMode("in");
  }

  /* ---------- live data ---------- */
  let unsubs = [];
  function stopData(L) {
    unsubs.forEach((u) => { try { u(); } catch (e) { /* ignore */ } });
    unsubs = [];
    for (const k of COLS) { L.state.loaded[k] = false; L.state[k] = new Map(); }
    L.state.db = null; L.state.dbError = null;
  }
  function startData(L) {
    stopData(L);
    const st = L.state;
    st.db = Store.db;
    for (const col of COLS) {
      unsubs.push(Store.db.collection(col).onSnapshot((snap) => {
        const m = new Map();
        for (const d of snap.docs) m.set(d.id, d.data());
        st[col] = m; st.loaded[col] = true; L.render();
      }, (err) => { st.dbError = err; L.render(); }));
    }
  }

  /* ---------- settings ---------- */
  let pendingRestore = null;
  function openSettings(L) {
    const { esc, state } = L;
    const key = Reader.getKey(), model = Reader.getModel();
    pendingRestore = null;
    const html = `<form class="sheet-form" id="set-form" novalidate>
      <header class="sh-head gut"><h2 id="sh-title">Settings</h2><button type="button" class="x" data-sh="close" aria-label="Close">✕</button></header>
      <div class="sh-body gut">
        <section class="sec">
          <h3 class="eyebrow">Account</h3>
          <p>Signed in as <b>${esc(state.user ? state.user.email : "")}</b></p>
          <div><button type="button" class="btn small" data-sh="st-signout">Sign out</button></div>
        </section>
        <section class="sec">
          <h3 class="eyebrow">Reading invoices and receipts</h3>
          <p class="muted sm">${isNative ? "Slab labels are read on this phone first, free and offline. " : ""}Invoices, receipts and anything the phone can't read go to Claude with your own Anthropic API key, billed to that account.</p>
          <div class="field"><label for="st-key">Anthropic API key</label><input id="st-key" type="password" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="${key ? "Saved, ends in " + esc(key.slice(-4)) : "sk-ant-…"}"></div>
          <p class="hint">Create one at console.anthropic.com under API keys. It's kept on this device only, so add it on each phone or computer you use.</p>
          <div class="field"><span class="lab" id="st-m-lab">Model</span><div class="status-pick duo" role="radiogroup" aria-labelledby="st-m-lab">
            ${Object.entries(Reader.MODELS).map(([k, m]) => `<label class="sp stock"><input type="radio" name="stmodel" id="st-m-${k}" value="${k}"${model === k ? " checked" : ""}><span>${m.label}</span></label>`).join("")}
          </div><span class="hint" id="st-m-note">${esc(Reader.MODELS[model].note)}</span></div>
          <div class="btnrow"><button type="button" class="btn small" data-sh="st-test">Check key</button>${key ? `<button type="button" class="btn small ghost danger" data-sh="st-clear">Remove key</button>` : ""}</div>
          <p class="hint" id="st-msg" aria-live="polite"></p>
        </section>
        <section class="sec">
          <h3 class="eyebrow">Backup</h3>
          <p class="muted sm">Your ledger lives in your Firebase project, with a copy on each device you sign in on. A backup file is one more copy you control. Restoring one also brings in a ledger from the Claude version.</p>
          <div class="btnrow"><button type="button" class="btn small" data-sh="st-backup">Save a backup file</button><span class="btn small pick-inline">Restore from a backup<input class="pick-in" id="st-restore" type="file" accept="application/json,.json" aria-label="Choose a backup file"></span></div>
          <div id="st-restore-out"></div>
        </section>
        <section class="sec"><p class="hint">Coin Ledger ${esc(VERSION)}</p></section>
      </div>
      <footer class="sh-foot gut" id="sh-foot"><span class="grow"></span><button type="button" class="btn ghost" data-sh="close">Close</button><button type="submit" class="btn primary" id="sh-save">Save</button></footer>
    </form>`;
    L.openSheet(html, {
      what: "settings",
      onChange(e) {
        if (e.target.name === "stmodel") L.panel.querySelector("#st-m-note").textContent = Reader.MODELS[e.target.value].note;
        if (e.target.id === "st-restore") { const file = e.target.files && e.target.files[0]; e.target.value = ""; if (file) readBackup(L, file); }
      },
      onAction(a) {
        if (a === "st-signout") { L.closeSheet(); Store.signOut().catch((err) => L.toast("Couldn't sign out: " + err.message)); }
        else if (a === "st-test") testKey(L);
        else if (a === "st-clear") { Reader.setKey(""); L.closeSheet(); L.toast("API key removed"); }
        else if (a === "st-backup") saveBackup(L);
        else if (a === "st-restore-go") doRestore(L);
        else if (a === "st-restore-no") { pendingRestore = null; L.panel.querySelector("#st-restore-out").innerHTML = ""; }
      },
      onSubmit(f) {
        const k = f.querySelector("#st-key").value.trim();
        if (k) Reader.setKey(k);
        const m = (f.querySelector("input[name=stmodel]:checked") || {}).value;
        if (m) Reader.setModel(m);
        L.closeSheet(); L.toast("Settings saved");
      }
    }, null);
  }
  async function testKey(L) {
    const f = L.panel.querySelector("#set-form"); if (!f) return;
    const out = f.querySelector("#st-msg"), typed = f.querySelector("#st-key").value.trim();
    if (!typed && !Reader.hasKey()) { out.textContent = "Paste your API key first."; return; }
    out.textContent = "Checking…";
    try { await Reader.check(typed || null); out.textContent = "The key works." + (typed ? " Tap Save to keep it." : ""); }
    catch (e) { out.textContent = L.scanErr(e); }
  }
  function saveBackup(L) {
    const data = {};
    for (const c of COLS) data[c] = Object.fromEntries(L.state[c]);
    const json = JSON.stringify({ app: "coin-ledger", format: 1, exported: new Date().toISOString(), data });
    exporter.save({ filename: "coin-ledger-backup-" + L.todayStr() + ".json", data: json })
      .then(() => L.toast("Backup saved"))
      .catch((e) => { if (!e || e.code !== "declined") L.toast("The backup didn't save. Try again."); });
  }
  async function readBackup(L, file) {
    const out = L.panel.querySelector("#st-restore-out"); if (!out) return;
    try {
      const j = JSON.parse(await file.text());
      const data = j && j.data;
      if (!data || typeof data !== "object") throw new Error("not a backup");
      const rows = [];
      for (const c of COLS) for (const [id, d] of Object.entries(data[c] || {})) {
        if (d && typeof d === "object" && /^[A-Za-z0-9_\-.~:@+]{1,200}$/.test(id)) rows.push(["set", c, id, d]);
      }
      if (!rows.length) throw new Error("empty");
      pendingRestore = rows;
      const n = (c) => rows.filter((r) => r[1] === c).length;
      out.innerHTML = `<div class="note warn"><p>This backup has ${n("coins")} coins, ${n("subs")} grading submissions, ${n("expenses")} expenses and ${n("moves")} money entries. Restoring adds them to your ledger and replaces any entry that has the same ID. Nothing else is deleted.</p><div class="btnrow"><button type="button" class="btn ghost" data-sh="st-restore-no">Cancel</button><button type="button" class="btn primary" data-sh="st-restore-go">Restore</button></div></div>`;
    } catch (e) {
      out.innerHTML = `<div class="note warn"><p>That file isn't a Coin Ledger backup.</p></div>`;
    }
  }
  function doRestore(L) {
    if (!pendingRestore) return;
    const rows = pendingRestore; pendingRestore = null;
    L.guarded(async () => { await L.runWrites(rows); L.closeSheet(); L.toast("Restored " + rows.length + " entries"); });
  }

  /* ---------- start ---------- */
  const showAuth = () => { byId("app").hidden = true; byId("auth").hidden = false; };
  const showApp = () => { byId("auth").hidden = true; byId("app").hidden = false; };

  window.LedgerPlatform = {
    kind: isNative ? "android" : "web",
    readLabel: Vision ? readLabel : null,
    canAsk: () => !!(Reader && Reader.hasKey()),
    pdfDirect: true,
    resizeTo: 2000,
    noDbText: "This copy of the app isn't connected to your Firebase project yet. Follow SETUP.md in the Coin-Ledger repository.",
    needDbText: "Sign in first.",
    start(L) {
      const st = L.state;
      st.sample = Reader;
      st.imgLimits = { maxCount: 10, maxInputBytes: 25e6, mediaTypes: ["image/jpeg", "image/png", "image/webp", "image/gif"] };
      st.dl = exporter;
      authUI();
      showApp();
      byId("settings-btn").addEventListener("click", () => { if (st.user) openSettings(L); });
      window.addEventListener("ledger-sync-error", (e) => L.toast(L.errMsg(e.detail)));
      if (AppPlugin) AppPlugin.addListener("backButton", () => {
        if (!L.sheet.hidden) { if (!st.busy) L.closeSheet(); return; }
        if (st.user && st.tab !== "overview") { st.tab = "overview"; L.store.set("tab", "overview"); L.render(); window.scrollTo({ top: 0 }); return; }
        AppPlugin.exitApp();
      });
      if (!Store || !Store.configured) { st.noDb = true; showAuth(); return; }
      Store.onAuth((user) => {
        st.user = user;
        if (user) { startData(L); showApp(); L.render(); }
        else { stopData(L); if (!L.sheet.hidden) L.closeSheet(); showAuth(); }
      });
    }
  };
})();
