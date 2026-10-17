// Coin Ledger as a claude.ai artifact: the artifact's own database, Claude reading through the
// viewer's Claude plan, and the artifact's download prompt for exports.
window.LedgerPlatform = {
  kind: "artifact",
  async start(L) {
    const { state, render } = L;
    const C = window.claude;
    if (!C || typeof C.use !== "function") { state.noDb = true; render(); return; }
    C.use("downloads").then((d) => { state.dl = d || null; if (d) render(); }).catch(() => {});
    C.use("sample").then(async (sm) => {
      if (!sm) return;
      let lim = null; try { lim = await sm.limits(); } catch (e) { lim = null; }
      if (lim && lim.images) { state.sample = sm; state.imgLimits = lim.images; render(); }
    }).catch(() => {});
    C.use("user").then(async (u) => { if (!u) return; try { state.readOnly = !(await u.canEdit()); render(); } catch (e) { /* ignore */ } }).catch(() => {});
    let db = null;
    try { db = await C.use("db"); } catch (e) { db = null; }
    if (!db) { state.noDb = true; render(); return; }
    state.db = db;
    for (const col of ["coins", "subs", "expenses", "accounts", "moves"]) {
      db.collection(col).onSnapshot((snap) => {
        const m = new Map();
        for (const d of snap.docs) if (d.exists) m.set(d.id, d.data());
        state[col] = m; state.loaded[col] = true; render();
      }, (err) => { state.dbError = err || { code: "unavailable" }; render(); });
    }
  }
};
