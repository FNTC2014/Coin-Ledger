(function(){
"use strict";
const $ = (s, r=document) => r.querySelector(s);
const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const money = new Intl.NumberFormat("en-CA",{style:"currency",currency:"CAD"});
const fmt = n => money.format(Math.abs(n) < 0.005 ? 0 : (n || 0));
const fmtS = n => (n < -0.004 ? "−" : "") + money.format(Math.abs(n || 0));
const fmtSigned = n => (n > 0.004 ? "+" : "") + fmtS(n);
const fmtNeg = n => (Math.abs(n) > 0.004 ? "−" : "") + money.format(Math.abs(n || 0));
const num = v => { const n = parseFloat(String(v == null ? "" : v).replace(/[$,\s]/g, "")); return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0; };
const sum = (arr, f) => Math.round(arr.reduce((a, x) => a + (f(x) || 0), 0) * 100) / 100;
const pad = n => String(n).padStart(2, "0");
const todayStr = () => { const d = new Date(); return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); };
const parseD = s => { const [y, m, d] = String(s).split("-").map(Number); return new Date(y, (m || 1) - 1, d || 1); };
const daysBetween = (a, b) => (!a || !b) ? null : Math.max(0, Math.round((parseD(b) - parseD(a)) / 86400000));
const daysSince = s => daysBetween(s, todayStr());
const thisYear = new Date().getFullYear();
const fmtDate = s => s ? parseD(s).toLocaleDateString("en-CA", {month:"short", day:"numeric", year:"numeric"}) : "—";
const fmtShort = s => { if (!s) return ""; const d = parseD(s); return d.toLocaleDateString("en-CA", d.getFullYear() === thisYear ? {month:"short", day:"numeric"} : {month:"short", day:"numeric", year:"numeric"}); };
const plural = (n, w) => n + " " + w + (n === 1 ? "" : "s");
// Where this page runs (a claude.ai artifact, the Android app, or the web version) sets window.LedgerPlatform first.
const Platform = window.LedgerPlatform || {};
const store = { get(k){ try { return localStorage.getItem("coinledger:" + k); } catch(e){ return null; } }, set(k, v){ try { localStorage.setItem("coinledger:" + k, v); } catch(e){} } };

const STATUS = {
  incoming:{label:"Awaiting receipt", cls:"in"},
  stock:{label:"In stock", cls:"stock"},
  grading:{label:"At grading", cls:"grade"},
  consigned:{label:"Consigned", cls:"con"},
  sold:{label:"Sold", cls:"sold"}
};
const GRADERS = ["Raw","PCGS","NGC","CGC","ICCS","CCCS","Other"];
const COMPANIES = ["PCGS","NGC","CGC","ICCS","CCCS","Other"];
const GRADES = ["G-4","G-6","VG-8","VG-10","F-12","F-15","VF-20","VF-25","VF-30","VF-35","EF-40","EF-45","XF-40","XF-45","AU-50","AU-53","AU-55","AU-58","MS-60","MS-61","MS-62","MS-63","MS-64","MS-65","MS-66","MS-67","PL-63","PL-64","PL-65","SP-65","PF-65","PF-67","PR-67"];
const VIA = ["eBay","Coin show","Private sale","Facebook group","Kijiji","Dealer buyout","Auction consignment"];
const SERVICES = ["Economy","Regular","Express","Walkthrough","Reconsideration","Value","Standard","Modern","Bulk"];
const EXP_CATS = ["Grading memberships","Supplies & holders","Shipping supplies","Show & table fees","Selling platform fees","Postage","Travel","Software & subscriptions","Reference books","Other"];
const TABS = [["overview","Overview"],["inventory","Inventory"],["grading","Grading"],["sales","Sales"],["expenses","Expenses"],["money","Money"]];
const PERIODS = [["month","This month"],["lastmonth","Last month"],["year","This year"],["lastyear","Last year"],["all","All time"]];
const FILTERS = [["active","Active"],["incoming","Awaiting"],["stock","In stock"],["listed","Listed"],["grading","At grading"],["consigned","Consigned"],["sold","Sold"],["all","All"]];
// An in-stock coin can be listed for sale somewhere (Facebook by default) and stays in stock until it sells.
const PLATFORMS = ["Facebook","Facebook auction","eBay","Kijiji","Coin show table","Website"];
const isListed = c => c.status === "stock" && !!c.listed;
const isAuction = c => (c.listFormat || "auction") === "auction";
const lastFormat = () => store.get("listFormat") === "fixed" ? "fixed" : "auction";
const priceWord = fmtKey => fmtKey === "fixed" ? "Asking price" : "Current bid";
const listPill = c => `<span class="pill list">Listed${c.listedOn ? " \u00b7 " + esc(c.listedOn) : ""}</span>`;
const HOUSES = ["TCNC","Geoffrey Bell Auctions","Heritage Auctions","Stack's Bowers","Torex"];
const ACCTS = [["cash","Cash"],["eq","EQ Bank"]];
const ACCT_NAME = {cash:"Cash", eq:"EQ Bank", other:"Card or other"};
const PAY_OPTS = [["eq","EQ Bank"],["cash","Cash"],["other","Card or other"]];
const isAcct = k => k === "cash" || k === "eq";
const HST = 0.13;
// ICCS prices before tax. Variety attribution comes free with grading; "Variety and reholder" is its own
// service for a coin that's already graded.
const ICCS_TIERS = [["regular","Regular grading",20],["week","One week grading",40],["2day","Two day grading",75],["1day","One day grading",150],["reholder","Variety and reholder",6]];
const iccsTier = k => ICCS_TIERS.find(t => t[0] === k);
const iccsCost = k => { const t = iccsTier(k); return t ? num(t[2] * (1 + HST)) : 0; };
const iccsDefault = (c, fallback) => (c && c.grader === "ICCS") ? "reholder" : (iccsTier(fallback) && fallback !== "reholder" ? fallback : "regular");
const ICCS_HINT = "ICCS prices are before tax. Picking a service fills in the cost with 13% HST included. Variety attribution comes with grading; Variety and reholder is for a coin that's already graded.";
const PAY_HINT_YES = "The sale price less selling fees and shipping is added to that balance on the date paid. Leave the date blank if it was paid the day it sold.";
const PAY_HINT_NO = "It counts as a sale now. Mark it paid later, on its own or with the buyer's other coins, and the money is added then.";
const MOVE_NOTES = ["Cash deposit to EQ Bank","Cash withdrawal from EQ Bank","Owner deposit","Owner draw","Interest","Bank fee","Balance adjustment"];

const state = {
  tab: "overview", period: "year", invFilter: "active", invQuery: "",
  coins: new Map(), subs: new Map(), expenses: new Map(), accounts: new Map(), moves: new Map(),
  loaded: {coins:false, subs:false, expenses:false, accounts:false, moves:false}, moneyFilter: "all", sample: null, imgLimits: null,
  db: null, dl: null, noDb: false, dbError: null, readOnly: false,
  chartSel: 11, sheet: null, clearAsk: false, busy: false
};
(function restore(){
  const h = location.hash.replace("#", "");
  const t = store.get("tab"), p = store.get("period"), f = store.get("filter");
  if (TABS.some(x => x[0] === h)) state.tab = h; else if (TABS.some(x => x[0] === t)) state.tab = t;
  if (PERIODS.some(x => x[0] === p)) state.period = p;
  if (FILTERS.some(x => x[0] === f)) state.invFilter = f;
})();

/* ---------- money helpers ---------- */
const basis = c => num((c.cost || 0) + (c.buyFees || 0) + (c.gradeCost || 0));
const netSale = c => num((c.salePrice || 0) - (c.saleFees || 0) - (c.shipCost || 0));
const profit = c => num(netSale(c) - basis(c));
const m2 = v => (Number(v) || 0).toFixed(2);

function periodRange(p){
  const d = new Date(), y = d.getFullYear(), mo = d.getMonth();
  const ym = (Y, M) => Y + "-" + pad(M + 1);
  if (p === "month") return [ym(y, mo) + "-01", ym(y, mo) + "-31"];
  if (p === "lastmonth"){ const D = new Date(y, mo - 1, 1); return [ym(D.getFullYear(), D.getMonth()) + "-01", ym(D.getFullYear(), D.getMonth()) + "-31"]; }
  if (p === "year") return [y + "-01-01", y + "-12-31"];
  if (p === "lastyear") return [(y - 1) + "-01-01", (y - 1) + "-12-31"];
  return ["0000-01-01", "9999-12-31"];
}
function periodName(p){
  const d = new Date();
  if (p === "month") return d.toLocaleDateString("en-CA", {month:"long", year:"numeric"});
  if (p === "lastmonth") return new Date(d.getFullYear(), d.getMonth() - 1, 1).toLocaleDateString("en-CA", {month:"long", year:"numeric"});
  if (p === "year") return String(d.getFullYear());
  if (p === "lastyear") return String(d.getFullYear() - 1);
  return "All time";
}
function periodTag(p){
  const r = periodRange(p);
  if (p === "month" || p === "lastmonth") return r[0].slice(0, 7);
  if (p === "year" || p === "lastyear") return r[0].slice(0, 4);
  return "all-time";
}
const inRange = (s, r) => !!s && s >= r[0] && s <= r[1];

function stats(p){
  const r = periodRange(p);
  const coins = [...state.coins.entries()];
  const sold = coins.filter(([, c]) => c.status === "sold" && inRange(c.soldOn, r));
  const revenue = sum(sold, ([, c]) => c.salePrice);
  const cogs = sum(sold, ([, c]) => basis(c));
  const selling = sum(sold, ([, c]) => (c.saleFees || 0) + (c.shipCost || 0));
  const gross = num(revenue - cogs - selling);
  const exps = [...state.expenses.entries()].filter(([, e]) => inRange(e.date, r));
  const expTotal = sum(exps, ([, e]) => e.amount);
  const bought = coins.filter(([, c]) => inRange(c.boughtOn, r));
  const subs = [...state.subs.values()].filter(s => inRange(s.sentOn, r));
  return { sold, revenue, cogs, selling, gross, exps, expTotal, net: num(gross - expTotal),
    bought, boughtTotal: sum(bought, ([, c]) => (c.cost || 0) + (c.buyFees || 0)),
    subs, gradingTotal: sum(subs, s => s.total) };
}
function pipeline(){
  const o = {incoming:{n:0, v:0}, stock:{n:0, v:0}, grading:{n:0, v:0}, consigned:{n:0, v:0}};
  for (const c of state.coins.values()) if (o[c.status]){ o[c.status].n++; o[c.status].v += basis(c); }
  return o;
}
const coinsInSub = id => [...state.coins.entries()].filter(([, c]) => c.subId === id);
// A sale can be recorded before the buyer pays (paid === false). It counts as a sale on the date sold;
// the money lands in Cash or EQ Bank on the date it's marked paid.
const isUnpaid = c => c.status === "sold" && c.paid === false;
const buyerKey = c => String(c.buyer || "").trim();
const buyerLabel = k => k || "No buyer named";
function owedGroups(){
  const g = new Map();
  for (const [id, c] of state.coins){
    if (!isUnpaid(c)) continue;
    const k = buyerKey(c);
    if (!g.has(k)) g.set(k, {buyer: k, items: [], total: 0, oldest: ""});
    const x = g.get(k);
    x.items.push([id, c]); x.total = num(x.total + (c.salePrice || 0));
    if (c.soldOn && (!x.oldest || c.soldOn < x.oldest)) x.oldest = c.soldOn;
  }
  return [...g.values()].sort((a, b) => (a.oldest || "9").localeCompare(b.oldest || "9"));
}
const houseKey = c => String(c.consignee || "").trim();
function consignGroups(){
  const g = new Map();
  for (const [id, c] of state.coins){
    if (c.status !== "consigned") continue;
    const k = houseKey(c);
    if (!g.has(k)) g.set(k, {house: k, items: [], value: 0, since: "", auctions: new Set()});
    const x = g.get(k);
    x.items.push([id, c]); x.value = num(x.value + basis(c));
    if (c.consignedOn && (!x.since || c.consignedOn < x.since)) x.since = c.consignedOn;
    if (c.auction) x.auctions.add(c.auction);
  }
  return [...g.values()].sort((a, b) => (a.since || "9").localeCompare(b.since || "9"));
}
const consRow = x => `<button class="row" data-act="consign-results" data-h="${esc(x.house)}"><span class="row-main"><span class="row-title">${esc(x.house || "Auction house not named")}</span><span class="row-sub">${plural(x.items.length, "coin")} consigned${x.since ? " · since " + fmtShort(x.since) : ""}${x.auctions.size ? " · " + esc([...x.auctions].join(", ")) : ""}</span></span><span class="row-side"><span class="pill con">Consigned</span><span class="fig">${fmt(x.value)}</span></span></button>`;
const owedRow = x => `<button class="row" data-act="collect" data-b="${esc(x.buyer)}"><span class="row-main"><span class="row-title">${esc(buyerLabel(x.buyer))}</span><span class="row-sub">${plural(x.items.length, "coin")} sold, not paid yet${x.oldest ? " · oldest " + fmtShort(x.oldest) : ""}</span></span><span class="row-side"><span class="pill in">Payment due</span><span class="fig">${fmt(x.total)}</span></span></button>`;
function ledger(){
  const out = [];
  const push = (date, acct, amt, label, col, id, x, when) => { if (isAcct(acct) && Math.abs(amt) > 0.004) out.push({date: date || "", acct, amt: num(amt), label, col, id, ex: !!(x && x.example), created: when || ""}); };
  for (const [id, c] of state.coins){
    push(c.boughtOn, c.payFrom, -((c.cost || 0) + (c.buyFees || 0)), "Bought " + (c.name || "coin"), "coins", id, c, c.created);
    if (c.status === "sold" && c.paid !== false) push(c.paidOn || c.soldOn, c.payTo, netSale(c), (c.paidOn && c.paidOn !== c.soldOn ? "Payment for " : "Sold ") + (c.name || "coin") + (c.buyer ? " (" + c.buyer + ")" : ""), "coins", id, c, c.updated);
  }
  for (const [id, x] of state.subs) push(x.sentOn, x.payFrom, -(x.total || 0), "Grading: " + (x.company || "") + (x.service ? " " + x.service : ""), "subs", id, x, x.created);
  for (const [id, e] of state.expenses) push(e.date, e.payFrom, -(e.amount || 0), e.description || e.category || "Expense", "expenses", id, e, e.created);
  for (const [id, m] of state.moves){
    const note = m.note || "";
    if (m.kind === "transfer"){
      push(m.date, m.from, -(m.amount || 0), note || "Transfer to " + ACCT_NAME[m.to], "moves", id, m, m.created);
      push(m.date, m.to, m.amount || 0, note || "Transfer from " + ACCT_NAME[m.from], "moves", id, m, m.created);
    } else if (m.kind === "in") push(m.date, m.to, m.amount || 0, note || "Money in", "moves", id, m, m.created);
    else push(m.date, m.from, -(m.amount || 0), note || "Money out", "moves", id, m, m.created);
  }
  return out;
}
function balances(){
  const b = {};
  for (const [k] of ACCTS){ const a = state.accounts.get(k) || {}; b[k] = {opening: num(a.opening || 0), since: a.since || "", set: state.accounts.has(k), bal: num(a.opening || 0), rows: []}; }
  for (const e of ledger()){ const x = b[e.acct]; if (!x) continue; if (x.since && e.date && e.date < x.since) continue; x.rows.push(e); x.bal += e.amt; }
  for (const k in b) b[k].bal = num(b[k].bal);
  return b;
}
const ledKey = e => (e.date || "") + "|" + (e.created || "");
const paySel = (id, cur) => `<select id="${id}">${PAY_OPTS.map(([k, l]) => `<option value="${k}"${k === cur ? " selected" : ""}>${l}</option>`).join("")}</select>`;
const lastPay = k => { const v = store.get(k); return PAY_OPTS.some(x => x[0] === v) ? v : "eq"; };
const scanBtn = (cls) => state.sample ? `<button class="btn${cls ? " " + cls : ""}" data-act="scan">Scan receipt or cert</button>` : "";
const hasExamples = () => [...state.coins.values(), ...state.subs.values(), ...state.expenses.values(), ...state.accounts.values(), ...state.moves.values()].some(x => x.example);
const isEmpty = () => !state.coins.size && !state.subs.size && !state.expenses.size && !state.accounts.size && !state.moves.size;
const exTag = x => x && x.example ? '<span class="ex">Example</span>' : "";
const pill = s => STATUS[s] ? `<span class="pill ${STATUS[s].cls}">${STATUS[s].label}</span>` : "";
const gradeLine = c => {
  const g = (c.grader && c.grader !== "Raw") ? (c.grader + (c.grade ? " " + c.grade : "")) : ("Raw" + (c.grade ? " " + c.grade : ""));
  return g;
};
const periodChips = () => `<div class="seg" role="group" aria-label="Period">${PERIODS.map(([k, l]) => `<button class="seg-b" data-act="period" data-p="${k}" aria-pressed="${state.period === k}">${l}</button>`).join("")}</div>`;
const ready = () => Object.values(state.loaded).every(Boolean);

/* ---------- views ---------- */
function notices(){
  let h = "";
  if (state.noDb) h += `<div class="note"><p>${esc(Platform.noDbText || "Saving isn't available in this view. Open Coin Ledger in Claude to see and record your inventory.")}</p></div>`;
  if (state.dbError) h += `<div class="note"><p>The ledger couldn't load. Reload the page to try again.</p></div>`;
  if (state.readOnly && ready() && isEmpty()) h += `<div class="note"><p>This ledger is private to its owner and editors, so there's nothing to show you here.</p></div>`;
  if (ready() && hasExamples()){
    h += state.clearAsk
      ? `<div class="note"><p><b>Delete every example entry?</b> Anything you've added yourself stays.</p><div class="btnrow"><button class="btn ghost" data-act="clear-no">Keep them</button><button class="btn danger-solid" data-act="clear-yes">Delete examples</button></div></div>`
      : `<div class="note"><p>Entries tagged <span class="ex" style="margin:0">Example</span> show how the ledger works. Clear them when you're ready to start.</p><button class="btn" data-act="clear-ask">Clear examples</button></div>`;
  }
  return h;
}

function welcome(){
  return `<section class="welcome card">
    <h2>Start your ledger</h2>
    <p>Add coins as you pay for them, mark them in stock when they arrive, send them out for grading, and mark them sold. Profit on each coin is worked out from what you paid, purchase fees and grading.</p>
    <div class="btnrow"><button class="btn primary" data-act="new-coin">Add a coin</button>${scanBtn()}<button class="btn" data-act="edit-acct">Set cash and EQ Bank balances</button><button class="btn" data-act="new-sub">New grading submission</button><button class="btn" data-act="new-exp">Log an expense</button></div>
  </section>`;
}

function overview(){
  if (isEmpty()) return welcome();
  const p = pipeline();
  const totalV = p.incoming.v + p.stock.v + p.grading.v + p.consigned.v, totalN = p.incoming.n + p.stock.n + p.grading.n + p.consigned.n;
  const s = stats(state.period);
  const bl = balances(), funds = num(bl.cash.bal + bl.eq.bal), anyMoney = state.accounts.size || bl.cash.rows.length || bl.eq.rows.length;
  const margin = s.revenue > 0 ? Math.round(s.gross / s.revenue * 1000) / 10 : null;
  const nListed = [...state.coins.values()].filter(isListed).length;
  const tile = k => `<button class="tile" data-act="goto-inv" data-f="${k}"><span class="tile-lab"><span class="dot ${STATUS[k].cls}"></span>${STATUS[k].label}</span><span class="tile-n">${p[k].n}</span><span class="fig">${fmt(p[k].v)}</span>${k === "stock" && nListed ? `<span class="tile-sub">${nListed} listed for sale</span>` : ""}</button>`;

  const months = monthly();
  const anySales = months.some(x => x.n > 0);
  const maxV = Math.max(1, ...months.map(x => x.rev), ...months.map(x => x.gp));
  const minV = Math.min(0, ...months.map(x => x.gp));
  const range = maxV - minV, zero = (-minV) / range * 100;
  const sel = months[Math.min(11, Math.max(0, state.chartSel))];
  const cols = months.map((x, i) => {
    const rh = x.rev / range * 100, gh = Math.abs(x.gp) / range * 100;
    const gpStyle = x.gp >= 0 ? `bottom:${zero}%;height:${gh}%` : `bottom:${zero - gh}%;height:${gh}%`;
    return `<button class="col" data-act="chart" data-i="${i}" aria-pressed="${state.chartSel === i}" aria-label="${x.label} ${x.year}: revenue ${fmt(x.rev)}, gross profit ${fmtS(x.gp)}"><span class="plot"><span class="zero" style="bottom:${zero}%"></span><span class="b rev" style="bottom:${zero}%;height:${rh}%"></span><span class="b gp${x.gp < 0 ? " loss" : ""}" style="${gpStyle}"></span></span><span class="mlab">${x.label.slice(0, 1)}</span></button>`;
  }).join("");

  const openSubs = [...state.subs.entries()].filter(([, x]) => x.status !== "returned").sort((a, b) => (a[1].sentOn || "").localeCompare(b[1].sentOn || ""));
  const incoming = [...state.coins.entries()].filter(([, c]) => c.status === "incoming").sort((a, b) => (a[1].boughtOn || "").localeCompare(b[1].boughtOn || ""));
  const owed = owedGroups(), owedTotal = num(owed.reduce((a, x) => a + x.total, 0));
  const attn = [
    ...owed.map(owedRow),
    ...consignGroups().map(consRow),
    ...openSubs.map(([id, x]) => { const d = daysSince(x.sentOn); const n = coinsInSub(id).length; return `<button class="row" data-act="edit-sub" data-id="${esc(id)}"><span class="row-main"><span class="row-title">${esc(x.company)}${x.service ? " · " + esc(x.service) : ""}${exTag(x)}</span><span class="row-sub">${plural(n, "coin")} out for grading · sent ${fmtShort(x.sentOn)}</span></span><span class="row-side">${pill("grading")}<span class="fig sm">${d == null ? "" : plural(d, "day") + " out"}</span></span></button>`; }),
    ...incoming.slice(0, 8).map(([id, c]) => { const d = daysSince(c.boughtOn); return `<button class="row" data-act="edit-coin" data-id="${esc(id)}"><span class="row-main"><span class="row-title">${esc(c.name)}${exTag(c)}</span><span class="row-sub">Paid ${fmtShort(c.boughtOn)}${c.source ? " · " + esc(c.source) : ""}</span></span><span class="row-side">${pill("incoming")}<span class="fig sm">${d == null ? "" : plural(d, "day") + " waiting"}</span></span></button>`; })
  ];
  if (incoming.length > 8) attn.push(`<button class="row" data-act="goto-inv" data-f="incoming"><span class="row-main"><span class="row-sub">${incoming.length - 8} more awaiting receipt</span></span><span class="row-side"><span class="fig sm">View all</span></span></button>`);

  return `
  <section class="block">
    <div class="block-head"><h2>On hand</h2><span class="cap">Valued at cost: price paid, purchase fees and grading</span></div>
    <div class="pipe">${tile("incoming")}${tile("stock")}${tile("grading")}${tile("consigned")}
      <div class="tile total"><span class="tile-lab">Total inventory</span><span class="tile-n">${fmt(totalV)}</span><span class="fig">${plural(totalN, "coin")}</span></div>
    </div>
    <div class="btnrow"><button class="btn primary" data-act="new-coin">Add coin</button>${scanBtn()}</div>
  </section>
  <section class="block">
    <div class="block-head"><h2>Money</h2><button class="btn small" data-act="tab" data-t="money">View activity</button></div>
    ${anyMoney ? `<div class="card stmt">
      <div class="sl"><span class="lbl">Cash</span><span class="fig ${bl.cash.bal < 0 ? "neg" : ""}">${fmtS(bl.cash.bal)}</span></div>
      <div class="sl"><span class="lbl">EQ Bank</span><span class="fig ${bl.eq.bal < 0 ? "neg" : ""}">${fmtS(bl.eq.bal)}</span></div>
      <div class="sl total"><span class="lbl">Total funds</span><span class="fig">${fmtS(funds)}</span></div>
      <div class="sl minor"><span class="lbl">Funds plus inventory at cost</span><span class="fig">${fmtS(funds + totalV)}</span></div>
      ${owedTotal ? `<div class="sl minor"><span class="lbl">Owed to you<small>${plural(owed.reduce((a, x) => a + x.items.length, 0), "coin")}</small></span><span class="fig">${fmt(owedTotal)}</span></div>` : ""}
    </div>${!state.accounts.size ? `<p class="cap">Starting balances aren't set, so these only reflect what you've recorded. <button class="linkbtn" data-act="edit-acct">Set them</button></p>` : ""}`
    : `<div class="card empty"><p>See your cash on hand and EQ Bank balance here. Set each starting balance, then choose which one pays whenever you record a purchase, sale, grading submission or expense.</p><button class="btn" data-act="edit-acct">Set starting balances</button></div>`}
  </section>
  <section class="block">
    <div class="block-head"><h2>Profit and loss · ${esc(periodName(state.period))}</h2>${periodChips()}</div>
    <div class="two">
      <div class="card stmt">
        <div class="sl"><span class="lbl">Sales<small>${plural(s.sold.length, "coin")}</small></span><span class="fig">${fmt(s.revenue)}</span></div>
        <div class="sl"><span class="lbl">Cost of coins sold</span><span class="fig">${fmtNeg(s.cogs)}</span></div>
        <div class="sl"><span class="lbl">Selling fees and shipping</span><span class="fig">${fmtNeg(s.selling)}</span></div>
        <div class="sl subtotal"><span class="lbl">Gross profit${margin != null ? `<small>${margin}% margin</small>` : ""}</span><span class="fig ${s.gross < 0 ? "neg" : ""}">${fmtS(s.gross)}</span></div>
        <div class="sl"><span class="lbl">Business expenses<small>${plural(s.exps.length, "entry").replace("entrys", "entries")}</small></span><span class="fig">${fmtNeg(s.expTotal)}</span></div>
        <div class="sl total"><span class="lbl">Net profit</span><span class="fig ${s.net < 0 ? "neg" : "pos"}">${fmtS(s.net)}</span></div>
        <div class="sl minor"><span class="lbl">Spent on coins<small>${plural(s.bought.length, "coin")} bought</small></span><span class="fig">${fmt(s.boughtTotal)}</span></div>
        <div class="sl minor"><span class="lbl">Grading submitted<small>${plural(s.subs.length, "submission")}</small></span><span class="fig">${fmt(s.gradingTotal)}</span></div>
      </div>
      <div class="card chart">
        <div class="block-head"><h3 class="eyebrow">Last 12 months</h3></div>
        ${anySales ? `
        <div class="chart-read" aria-live="polite"><b>${sel.label} ${sel.year}</b><span>${plural(sel.n, "sale")}</span><span>Revenue <span class="fig">${fmt(sel.rev)}</span></span><span>Gross profit <span class="fig ${sel.gp < 0 ? "neg" : ""}">${fmtS(sel.gp)}</span></span></div>
        <div class="bars"><div class="peak" style="top:0"><span>${fmt(maxV)}</span></div>${cols}</div>
        <div class="legend"><span><i style="background:var(--rev)"></i>Revenue</span><span><i style="background:var(--accent)"></i>Gross profit</span></div>`
        : `<div class="empty"><p>No sales in the last 12 months yet. Monthly revenue and profit show here once you mark coins sold.</p></div>`}
      </div>
    </div>
  </section>
  <section class="block">
    <div class="block-head"><h2>Waiting on</h2><span class="cap">Payments owed to you, coins at auction houses and grading, and coins paid for but not yet in hand</span></div>
    ${attn.length ? `<div class="list">${attn.join("")}</div>` : `<div class="card empty"><p>Nothing outstanding. Every sale is paid, everything you've paid for has arrived and nothing is out for grading.</p></div>`}
  </section>`;
}

function monthly(){
  const d = new Date(), out = [];
  for (let i = 11; i >= 0; i--){
    const D = new Date(d.getFullYear(), d.getMonth() - i, 1);
    out.push({key: D.getFullYear() + "-" + pad(D.getMonth() + 1), label: D.toLocaleDateString("en-CA", {month:"short"}).replace(".", ""), year: D.getFullYear(), rev: 0, gp: 0, n: 0});
  }
  const idx = {}; out.forEach((x, i) => idx[x.key] = i);
  for (const c of state.coins.values()){
    if (c.status !== "sold" || !c.soldOn) continue;
    const i = idx[c.soldOn.slice(0, 7)]; if (i == null) continue;
    out[i].rev += c.salePrice || 0; out[i].gp += profit(c); out[i].n++;
  }
  out.forEach(x => { x.rev = num(x.rev); x.gp = num(x.gp); });
  return out;
}

function invItems(){
  const q = state.invQuery.trim().toLowerCase(), f = state.invFilter;
  let arr = [...state.coins.entries()].filter(([, c]) => f === "all" ? true : f === "active" ? c.status !== "sold" : f === "listed" ? isListed(c) : c.status === f);
  if (q) arr = arr.filter(([, c]) => [c.name, c.grade, c.grader, c.cert, c.variety, c.comments, c.source, c.notes, c.soldVia, c.buyer, c.listed ? "listed " + (c.listedOn || "") : ""].join(" ").toLowerCase().includes(q));
  const key = c => c.status === "sold" ? (c.soldOn || "") : (c.boughtOn || "");
  arr.sort((a, b) => key(b[1]).localeCompare(key(a[1])) || String(a[1].name).localeCompare(String(b[1].name)));
  return arr;
}
function coinRow(id, c){
  const sub = [gradeLine(c), c.variety, c.comments, c.cert ? "#" + c.cert : "", c.status === "sold" ? "sold " + fmtShort(c.soldOn) + (c.buyer ? " to " + c.buyer : "") : (c.boughtOn ? "bought " + fmtShort(c.boughtOn) : "")].filter(Boolean).map(esc).join(" · ");
  let side;
  if (c.status === "sold"){ const pr = profit(c); side = `${isUnpaid(c) ? '<span class="pill in">Payment due</span>' : pill("sold")}<span class="fig">${fmt(c.salePrice)}</span><span class="fig sm ${pr < 0 ? "neg" : "pos"}">${fmtSigned(pr)}</span>`; }
  else if (isListed(c)) side = `${listPill(c)}<span class="fig">${fmt(basis(c))}</span>${c.askPrice ? `<span class="fig sm muted">${isAuction(c) ? "bid" : "asking"} ${fmt(c.askPrice)}</span>` : (isAuction(c) && c.listEnds ? `<span class="fig sm muted">ends ${fmtShort(c.listEnds)}</span>` : "")}`;
  else side = `${pill(c.status)}<span class="fig">${fmt(basis(c))}</span>`;
  return `<button class="row" data-act="edit-coin" data-id="${esc(id)}"><span class="row-main"><span class="row-title">${esc(c.name || "Untitled coin")}${exTag(c)}</span><span class="row-sub">${sub}</span></span><span class="row-side">${side}</span></button>`;
}
function invListHTML(){
  const arr = invItems();
  const coins = arr.map(x => x[1]);
  const unsold = coins.filter(c => c.status !== "sold"), sold = coins.filter(c => c.status === "sold");
  let line = `<b>${plural(arr.length, "coin")}</b>`;
  if (unsold.length) line += `<span>${fmt(sum(unsold, basis))} at cost</span>`;
  if (sold.length) line += `<span>${fmt(sum(sold, c => c.salePrice))} sold, ${fmtSigned(sum(sold, profit))} profit</span>`;
  if (!state.coins.size) return `<div class="card empty"><p>No coins yet. Add the first one you've bought, even if it hasn't arrived.</p><button class="btn primary" data-act="new-coin">Add a coin</button></div>`;
  if (!arr.length) return `<div class="sumline">${line}</div><div class="card empty"><p>No coins match${state.invQuery ? ` “${esc(state.invQuery)}”` : ""} in this view.</p></div>`;
  return `<div class="sumline">${line}</div><div class="list">${arr.map(([id, c]) => coinRow(id, c)).join("")}</div>`;
}
function inventory(){
  const counts = {active:0, all:state.coins.size, incoming:0, stock:0, listed:0, grading:0, consigned:0, sold:0};
  for (const c of state.coins.values()){ if (counts[c.status] != null) counts[c.status]++; if (c.status !== "sold") counts.active++; if (isListed(c)) counts.listed++; }
  return `
  <div class="vhead"><div><h2>Inventory</h2><p class="muted">Every coin you've paid for, from purchase through grading to sale.</p></div><div class="btnrow">${scanBtn()}<button class="btn" data-act="consign">Consign coins</button><button class="btn primary" data-act="new-coin">Add coin</button></div></div>
  <div class="block">
    <div class="toolbar"><input class="search" id="inv-q" type="search" placeholder="Search coin, grade, cert #, seller" value="${esc(state.invQuery)}" aria-label="Search inventory" autocomplete="off"><button class="btn" data-act="list-coins">Mark listed</button></div>
    <div class="seg" role="group" aria-label="Filter">${FILTERS.map(([k, l]) => `<button class="seg-b" data-act="inv-filter" data-f="${k}" aria-pressed="${state.invFilter === k}">${l} <span class="fig sm">${counts[k]}</span></button>`).join("")}</div>
    <div id="inv-list" class="block">${invListHTML()}</div>
    ${state.dl && state.coins.size ? `<div class="btnrow"><button class="btn" data-act="export-coins">Export inventory (CSV)</button><button class="btn" data-act="export-all">Back up everything</button></div>` : ""}
  </div>`;
}

function subCard(id, x){
  const n = coinsInSub(id).length, ret = x.status === "returned";
  const d = ret ? daysBetween(x.sentOn, x.returnedOn) : daysSince(x.sentOn);
  return `<div class="subcard">
    <button class="sub-main" data-act="edit-sub" data-id="${esc(id)}">
      <span class="row-title">${esc(x.company)}${x.service ? " · " + esc(x.service) : ""}${exTag(x)}</span>
      <span class="row-sub">Sent ${fmtDate(x.sentOn)}${x.ref ? " · " + esc(x.ref) : ""}</span>
      <span class="row-sub">${plural(n, "coin")} · <span class="fig">${fmt(x.total)}</span>${n ? ` · <span class="fig">${fmt((x.total || 0) / n)}</span> each` : ""}</span>
    </button>
    <div class="sub-side">${d != null ? `<span class="days"><b>${d}</b>${d === 1 ? "day" : "days"} ${ret ? "turnaround" : "out"}</span>` : ""}${ret ? `<span class="sm muted">Back ${fmtShort(x.returnedOn)}</span>` : `<button class="btn small" data-act="return-sub" data-id="${esc(id)}">Mark returned</button>`}</div>
  </div>`;
}
function grading(){
  const all = [...state.subs.entries()];
  const open = all.filter(([, x]) => x.status !== "returned").sort((a, b) => (a[1].sentOn || "").localeCompare(b[1].sentOn || ""));
  const done = all.filter(([, x]) => x.status === "returned").sort((a, b) => (b[1].returnedOn || "").localeCompare(a[1].returnedOn || ""));
  const outV = sum(open, ([id]) => sum(coinsInSub(id), ([, c]) => basis(c)));
  return `
  <div class="vhead"><div><h2>Grading</h2><p class="muted">Each submission's total cost is split evenly across its coins and added to their cost.</p></div><button class="btn primary" data-act="new-sub">New submission</button></div>
  <section class="block">
    <div class="block-head"><h3 class="eyebrow">Out at grader · ${open.length}</h3>${open.length ? `<span class="cap">${fmt(outV)} of inventory out</span>` : ""}</div>
    ${open.length ? `<div class="list">${open.map(([id, x]) => subCard(id, x)).join("")}</div>` : `<div class="card empty"><p>Nothing is out for grading. Start a submission and pick the in-stock coins you're sending.</p></div>`}
  </section>
  <section class="block">
    <div class="block-head"><h3 class="eyebrow">Returned · ${done.length}</h3></div>
    ${done.length ? `<div class="list">${done.map(([id, x]) => subCard(id, x)).join("")}</div>` : `<div class="card empty"><p>Returned submissions show here with their turnaround time.</p></div>`}
  </section>`;
}

function sales(){
  const s = stats(state.period);
  const arr = s.sold.slice().sort((a, b) => (b[1].soldOn || "").localeCompare(a[1].soldOn || ""));
  const margin = s.revenue > 0 ? (Math.round(s.gross / s.revenue * 1000) / 10) + "%" : "—";
  const owed = owedGroups(), owedTotal = num(owed.reduce((a, x) => a + x.total, 0));
  return `
  <div class="vhead"><div><h2>Sales · ${esc(periodName(state.period))}</h2><p class="muted">Profit is the sale price less fees, shipping and each coin's full cost.</p></div><button class="btn primary" data-act="record-sale">Record a sale</button></div>
  ${periodChips()}
  <div class="strip">
    <div><span class="k">Coins sold</span><span class="v">${s.sold.length}</span></div>
    <div><span class="k">Revenue</span><span class="v">${fmt(s.revenue)}</span></div>
    <div><span class="k">Gross profit</span><span class="v ${s.gross < 0 ? "neg" : ""}">${fmtS(s.gross)}</span></div>
    <div><span class="k">Margin</span><span class="v">${margin}</span></div>
  </div>
  ${owed.length ? `<section class="block"><div class="block-head"><h3 class="eyebrow">Waiting for payment · ${fmt(owedTotal)}</h3><span class="cap">All dates. Tap a buyer to mark coins paid.</span></div><div class="list">${owed.map(owedRow).join("")}</div></section>` : ""}
  ${arr.length ? `<div class="list">${arr.map(([id, c]) => { const pr = profit(c); return `<button class="row" data-act="edit-coin" data-id="${esc(id)}"><span class="row-main"><span class="row-title">${esc(c.name)}${exTag(c)}</span><span class="row-sub">${esc([fmtShort(c.soldOn), c.soldVia, c.buyer, gradeLine(c)].filter(Boolean).join(" · "))}</span></span><span class="row-side">${isUnpaid(c) ? '<span class="pill in">Payment due</span>' : ""}<span class="fig">${fmt(c.salePrice)}</span><span class="fig sm ${pr < 0 ? "neg" : "pos"}">${fmtSigned(pr)}</span></span></button>`; }).join("")}</div>`
    : `<div class="card empty"><p>${state.period === "all" ? "No sales recorded yet." : "No sales recorded for " + esc(periodName(state.period)) + "."}</p><button class="btn" data-act="record-sale">Record a sale</button></div>`}
  ${state.dl && arr.length ? `<div class="btnrow"><button class="btn" data-act="export-sales">Export these sales (CSV)</button></div>` : ""}`;
}

function expenses(){
  const s = stats(state.period);
  const arr = s.exps.slice().sort((a, b) => (b[1].date || "").localeCompare(a[1].date || ""));
  const cats = {};
  for (const [, e] of arr) cats[e.category || "Other"] = (cats[e.category || "Other"] || 0) + (e.amount || 0);
  const catArr = Object.entries(cats).sort((a, b) => b[1] - a[1]);
  const maxC = Math.max(1, ...catArr.map(x => x[1]));
  return `
  <div class="vhead"><div><h2>Expenses · ${esc(periodName(state.period))}</h2><p class="muted">Running costs that aren't tied to one coin: supplies, show tables, memberships, postage.</p></div><button class="btn primary" data-act="new-exp">Log expense</button></div>
  ${periodChips()}
  ${arr.length ? `
  <div class="two">
    <div class="card cats">
      <div class="sl total" style="border:0"><span class="lbl">Total</span><span class="fig">${fmt(s.expTotal)}</span></div>
      ${catArr.map(([k, v]) => `<div class="cat"><span>${esc(k)}</span><span class="fig">${fmt(v)}</span><span class="bar"><span style="width:${(v / maxC * 100).toFixed(1)}%"></span></span></div>`).join("")}
    </div>
    <div class="list">${arr.map(([id, e]) => `<button class="row" data-act="edit-exp" data-id="${esc(id)}"><span class="row-main"><span class="row-title">${esc(e.description || e.category || "Expense")}${exTag(e)}</span><span class="row-sub">${esc([fmtShort(e.date), e.category].filter(Boolean).join(" · "))}</span></span><span class="row-side"><span class="fig">${fmt(e.amount)}</span></span></button>`).join("")}</div>
  </div>` : `<div class="card empty"><p>${state.period === "all" ? "No expenses logged yet." : "No expenses logged for " + esc(periodName(state.period)) + "."}</p><button class="btn" data-act="new-exp">Log expense</button></div>`}
  ${state.dl && arr.length ? `<div class="btnrow"><button class="btn" data-act="export-exp">Export these expenses (CSV)</button></div>` : ""}`;
}

function ledRow(e, showRun){
  return `<button class="row" data-act="led" data-col="${e.col}" data-id="${esc(e.id)}"><span class="row-main"><span class="row-title">${esc(e.label)}${e.ex ? '<span class="ex">Example</span>' : ""}</span><span class="row-sub">${esc(fmtShort(e.date) || "No date")} · ${ACCT_NAME[e.acct]}</span></span><span class="row-side"><span class="fig ${e.amt < 0 ? "" : "pos"}">${e.amt < 0 ? fmtS(e.amt) : "+" + fmt(e.amt)}</span>${showRun ? `<span class="fig sm muted">${fmtS(e.run)}</span>` : ""}</span></button>`;
}
function moneyView(){
  const b = balances(), f = state.moneyFilter;
  const total = num(b.cash.bal + b.eq.bal);
  let rows = f === "all" ? [...b.cash.rows, ...b.eq.rows].map(e => ({...e})) : b[f].rows.map(e => ({...e}));
  if (f !== "all"){ rows.sort((x, y) => ledKey(x).localeCompare(ledKey(y))); let run = b[f].opening; rows.forEach(e => { run = num(run + e.amt); e.run = run; }); }
  rows.sort((x, y) => ledKey(y).localeCompare(ledKey(x)));
  const shown = rows.slice(0, 80);
  const acctCard = k => { const x = b[k]; return `<div class="acct">
      <span class="tile-lab">${ACCT_NAME[k]}</span>
      <span class="acct-bal ${x.bal < 0 ? "neg" : ""}">${fmtS(x.bal)}</span>
      <span class="cap">${x.set ? "Started at " + fmt(x.opening) + " on " + fmtShort(x.since) : "Starting balance not set"}${exTag(state.accounts.get(k))}</span>
      <button class="linkbtn sm" data-act="edit-acct">${x.set ? "Update balance" : "Set balance"}</button>
    </div>`; };
  return `
  <div class="vhead"><div><h2>Money</h2><p class="muted">Cash on hand and your EQ Bank account. Purchases, sales, grading and expenses paid from either one move these balances.</p></div>
    <div class="btnrow"><button class="btn" data-act="new-move" data-k="transfer">Transfer</button><button class="btn" data-act="new-move" data-k="in">Money in</button><button class="btn" data-act="new-move" data-k="out">Money out</button></div></div>
  <div class="accts">${acctCard("cash")}${acctCard("eq")}<div class="acct total"><span class="tile-lab">Total funds</span><span class="acct-bal ${total < 0 ? "neg" : ""}">${fmtS(total)}</span><span class="cap">Cash plus EQ Bank</span></div></div>
  <section class="block">
    <div class="block-head"><h3 class="eyebrow">Activity</h3><div class="seg" role="group" aria-label="Account">${[["all","Both"],["cash","Cash"],["eq","EQ Bank"]].map(([k, l]) => `<button class="seg-b" data-act="money-filter" data-f="${k}" aria-pressed="${f === k}">${l}</button>`).join("")}</div></div>
    ${f !== "all" && shown.length ? `<p class="cap">Newest first, with the running balance under each amount.</p>` : ""}
    ${shown.length ? `<div class="list">${shown.map(e => ledRow(e, f !== "all")).join("")}</div>${rows.length > 80 ? `<p class="cap">Showing the latest 80 of ${rows.length}. Export for the full list.</p>` : ""}`
      : `<div class="card empty"><p>No money movements yet. Choose Cash or EQ Bank as the account that paid when you add a coin, grading submission or expense, and log transfers here.</p></div>`}
    ${state.dl && rows.length ? `<div class="btnrow"><button class="btn" data-act="export-money">Export activity (CSV)</button></div>` : ""}
  </section>`;
}

const VIEWS = {overview, inventory, grading, sales, expenses, money: moneyView};
const main = $("#main"), tabsEl = $("#tabs");

function renderTabs(){
  let active = 0, open = 0;
  for (const c of state.coins.values()) if (c.status !== "sold") active++;
  for (const x of state.subs.values()) if (x.status !== "returned") open++;
  const badge = {inventory: active, grading: open};
  tabsEl.innerHTML = TABS.map(([k, l]) => `<button class="tab" role="tab" data-tab="${k}" aria-selected="${state.tab === k}">${l}${badge[k] ? `<span class="badge">${badge[k]}</span>` : ""}</button>`).join("");
}
function render(){
  renderTabs();
  const ae = document.activeElement;
  const aid = ae && ae.id && main.contains(ae) ? ae.id : null;
  let sel = null;
  if (aid && ae.tagName === "INPUT"){ try { sel = [ae.selectionStart, ae.selectionEnd]; } catch(e){} }
  if (!state.noDb && !state.dbError && !ready()){
    main.innerHTML = `<div class="loading card">Opening your ledger. Your inventory, grading submissions, sales and expenses will appear here.</div>`;
    return;
  }
  main.innerHTML = notices() + (state.noDb && !state.coins.size ? welcomeOffline() : VIEWS[state.tab]());
  if (aid){ const el = document.getElementById(aid); if (el){ el.focus({preventScroll:true}); if (sel) try { el.setSelectionRange(sel[0], sel[1]); } catch(e){} } }
}
function welcomeOffline(){
  return `<section class="welcome card"><h2>Coin Ledger</h2><p>Track coins you've paid for, what's in stock, what's out at PCGS, NGC, CGC or ICCS, and what you've sold, with profit worked out per coin and for the year.</p></section>`;
}

/* ---------- writes ---------- */
let syncTimer = null;
function setSync(t, hold){ const el = $("#sync"); el.textContent = t; clearTimeout(syncTimer); if (!hold) syncTimer = setTimeout(() => { el.textContent = ""; }, 2500); }
function errMsg(e){
  switch (e && e.code){
    case "permission-denied": case "unauthenticated": return "Your sign-in doesn't allow that change. Sign out and back in, then try again.";
    case "resource-exhausted": return "Too many changes at once. Wait a moment and try again.";
    case "quota_exceeded": return "Your ledger is full. Delete some old entries to make room.";
    case "invalid_argument": return "That change was refused. Only the owner and editors can change this ledger.";
    case "resource_exhausted": return "Too many changes at once. Wait a moment and try again.";
    case "revoked": return "Access to this ledger changed. Reload the page.";
    default: return "Couldn't save. Check your connection and try again.";
  }
}
async function retry(fn){
  try { return await fn(); }
  catch(e){ if (e && e.code === "unavailable"){ await new Promise(r => setTimeout(r, 400 + Math.random() * 700)); return await fn(); } throw e; }
}
async function runWrites(list){
  if (!state.db) throw {code:"unavailable"};
  if (state.db.batch && list.length > 1){ setSync("Saving\u2026", true); await state.db.batch(list); setSync("All changes saved"); return; }
  for (let i = 0; i < list.length; i++){
    const [op, col, id, data] = list[i];
    setSync(list.length > 2 ? `Saving ${i + 1} of ${list.length}…` : "Saving…", true);
    const ref = state.db.collection(col).doc(id);
    await retry(() => op === "del" ? ref.delete() : ref.set(data));
  }
  setSync("All changes saved");
}
const newId = col => state.db.collection(col).doc().id;
const nowIso = () => new Date().toISOString();

/* ---------- toast ---------- */
let toastTimer = null;
function toast(t){ const el = $("#toast"); el.textContent = t; el.hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => { el.hidden = true; }, 2800); }

/* ---------- CSV ---------- */
function csv(rows){ return rows.map(r => r.map(v => { const s = v == null ? "" : String(v); return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }).join(",")).join("\r\n"); }
async function offer(filename, rows){
  if (!state.dl){ toast("Exports work when the ledger is open in Claude."); return; }
  try { await state.dl.save({filename, data: "﻿" + csv(rows)}); toast("Exported " + filename); }
  catch(e){
    if (e && e.code === "declined") return;
    if (e && e.code === "rate_limited"){ toast("An export is already waiting for you to confirm."); return; }
    toast("The export didn't go through. Try again.");
  }
}
// Everything in one file: a backup, and how a ledger moves between the Claude version and the app.
async function exportAll(){
  if (!state.dl){ toast("Exports work when the ledger is open in Claude."); return; }
  const data = {};
  for (const c of ["coins", "subs", "expenses", "accounts", "moves"]) data[c] = Object.fromEntries(state[c]);
  const filename = "coin-ledger-backup-" + todayStr() + ".json";
  try { await state.dl.save({filename, data: JSON.stringify({app: "coin-ledger", format: 1, exported: nowIso(), data})}); toast("Saved " + filename); }
  catch(e){ if (!e || e.code !== "declined") toast("The backup didn't save. Try again."); }
}
function exportCoins(){
  const rows = [["Coin","Grader","Grade","Cert #","Variety","Cert comments","Status","Listed on","Current bid or asking price","Consigned to","Bought on","Bought from","Price paid","Purchase fees","Grading cost","Cost basis","Sold on","Sold via","Buyer","Paid on","Sale price","Selling fees","Shipping","Net from sale","Profit","Notes"]];
  const arr = [...state.coins.values()].sort((a, b) => (a.boughtOn || "").localeCompare(b.boughtOn || ""));
  for (const c of arr){ const s = c.status === "sold";
    rows.push([c.name, c.grader, c.grade, c.cert, c.variety || "", c.comments || "", (STATUS[c.status] || {}).label || c.status, isListed(c) ? (c.listedOn || "Listed") : "", isListed(c) && c.askPrice ? m2(c.askPrice) : "", c.status === "consigned" ? (c.consignee || "") : "", c.boughtOn, c.source, m2(c.cost), m2(c.buyFees), m2(c.gradeCost), m2(basis(c)), s ? c.soldOn : "", s ? c.soldVia : "", s ? c.buyer || "" : "", s ? (c.paid === false ? "Not paid" : (c.paidOn || c.soldOn)) : "", s ? m2(c.salePrice) : "", s ? m2(c.saleFees) : "", s ? m2(c.shipCost) : "", s ? m2(netSale(c)) : "", s ? m2(profit(c)) : "", c.notes]); }
  offer(`coin-inventory-${todayStr()}.csv`, rows);
}
function exportSales(){
  const s = stats(state.period);
  const rows = [["Sold on","Coin","Grader","Grade","Cert #","Variety","Cert comments","Sold via","Buyer","Paid on","Sale price","Selling fees","Shipping","Net from sale","Price paid","Purchase fees","Grading cost","Cost basis","Profit"]];
  for (const [, c] of s.sold.slice().sort((a, b) => (a[1].soldOn || "").localeCompare(b[1].soldOn || "")))
    rows.push([c.soldOn, c.name, c.grader, c.grade, c.cert, c.variety || "", c.comments || "", c.soldVia, c.buyer || "", c.paid === false ? "Not paid" : (c.paidOn || c.soldOn), m2(c.salePrice), m2(c.saleFees), m2(c.shipCost), m2(netSale(c)), m2(c.cost), m2(c.buyFees), m2(c.gradeCost), m2(basis(c)), m2(profit(c))]);
  rows.push([]); rows.push(["Total","","","","","","","","","",m2(s.revenue),"","","","","","",m2(s.cogs),m2(s.gross)]);
  offer(`coin-sales-${periodTag(state.period)}.csv`, rows);
}
function exportExpenses(){
  const s = stats(state.period);
  const rows = [["Date","Category","Description","Amount","Notes"]];
  for (const [, e] of s.exps.slice().sort((a, b) => (a[1].date || "").localeCompare(b[1].date || ""))) rows.push([e.date, e.category, e.description, m2(e.amount), e.notes]);
  rows.push([]); rows.push(["Total","","",m2(s.expTotal),""]);
  offer(`coin-expenses-${periodTag(state.period)}.csv`, rows);
}
function exportMoney(){
  const b = balances(), rows = [["Date","Account","Description","Amount","Balance"]];
  for (const [k] of ACCTS){
    const x = b[k]; let run = x.opening;
    rows.push([x.since, ACCT_NAME[k], "Starting balance", "", m2(run)]);
    for (const e of x.rows.slice().sort((p, q) => ledKey(p).localeCompare(ledKey(q)))){ run = num(run + e.amt); rows.push([e.date, ACCT_NAME[k], e.label, m2(e.amt), m2(run)]); }
    rows.push([]);
  }
  offer(`coin-money-${todayStr()}.csv`, rows);
}

/* ---------- sheet ---------- */
const sheet = $("#sheet"), panel = $("#sheet .panel");
function openSheet(html, ctx, focusSel){
  panel.innerHTML = html; state.sheet = ctx; sheet.hidden = false; document.body.classList.add("lock");
  const f = focusSel && panel.querySelector(focusSel);
  if (f) setTimeout(() => f.focus(), 30); else { const x = panel.querySelector(".x"); if (x) x.focus({preventScroll:true}); }
}
function closeSheet(){ const ctx = state.sheet; sheet.hidden = true; panel.innerHTML = ""; state.sheet = null; document.body.classList.remove("lock"); if (ctx && ctx.onClose) try { ctx.onClose(); } catch(e){} }
const opts = (list, cur) => list.map(v => `<option${v === cur ? " selected" : ""}>${esc(v)}</option>`).join("");
const dl = (id, list) => `<datalist id="${id}">${[...new Set(list.filter(Boolean))].map(v => `<option value="${esc(v)}"></option>`).join("")}</datalist>`;
const mv = v => (v === 0 || v === "" || v == null) ? "" : String(v);
const footHTML = existing => `${existing ? `<button type="button" class="btn ghost danger" data-sh="ask-del">Delete</button>` : ""}<span class="grow"></span><button type="button" class="btn ghost" data-sh="close">Cancel</button><button type="submit" class="btn primary" id="sh-save">Save</button>`;
const askHTML = what => `<span class="confirm-q">Delete this ${what} for good?</span><span class="grow"></span><button type="button" class="btn ghost" data-sh="keep">Keep</button><button type="button" class="btn danger-solid" data-sh="del">Delete</button>`;
async function guarded(fn){
  if (state.busy) return; state.busy = true;
  const b = panel.querySelector("#sh-save"); if (b) b.disabled = true;
  try { await fn(); }
  catch(e){ setSync(""); toast(errMsg(e)); if (b) b.disabled = false; }
  finally { state.busy = false; }
}

/* coin */
function openCoin(id, preset){
  const src = id ? state.coins.get(id) : null;
  if (id && !src) return;
  const c = Object.assign(src ? {...src} : {name:"", grader:"Raw", grade:"", cert:"", status:"incoming", boughtOn: todayStr(), source:"", cost:0, buyFees:0, gradeCost:0, soldOn:"", soldVia:"", salePrice:0, saleFees:0, shipCost:0, notes:""}, preset || {});
  const sub = c.subId ? state.subs.get(c.subId) : null;
  const payFrom = c.payFrom || (src ? "other" : lastPay("payFrom"));
  const payTo = c.payTo || (src && src.status === "sold" ? "other" : lastPay("payTo"));
  const sources = [...state.coins.values()].map(x => x.source);
  const vias = VIA.concat([...state.coins.values()].map(x => x.soldVia));
  const buyers = [...state.coins.values()].map(x => x.buyer);
  const unpaid = c.paid === false;
  const lf = c.listed ? (c.listFormat || "auction") : lastFormat();
  const html = `<form class="sheet-form" id="coin-form" novalidate>
    <header class="sh-head gut"><h2 id="sh-title">${src ? esc(c.name || "Coin") : "Add a coin"}</h2><button type="button" class="x" data-sh="close" aria-label="Close">✕</button></header>
    <div class="sh-body gut">
      <div class="kpis" id="coin-kpis"></div>
      <section class="sec">
        <h3 class="eyebrow">Coin</h3>
        ${state.sample ? `<div class="pick slim">${ICON_CAM}<span><b>Fill from cert photo</b><small>Reads the grader, grade, cert number and variety off the label and fills in what's missing</small></span><input class="pick-in" id="f-certphoto" type="file" accept="image/*" aria-label="Photo of the cert or slab label"></div>
        <div id="f-certout" aria-live="polite"></div>` : ""}
        <div class="field"><label for="f-name">Coin</label><input id="f-name" value="${esc(c.name)}" placeholder="e.g. 1955 Arnprior $1" autocomplete="off"></div>
        <div class="grid2">
          <div class="field"><label for="f-grader">Grader</label><select id="f-grader">${opts(GRADERS, c.grader || "Raw")}</select></div>
          <div class="field"><label for="f-grade">Grade</label><input id="f-grade" list="dl-grades" value="${esc(c.grade)}" placeholder="MS-64" autocomplete="off"></div>
          <div class="field"><label for="f-cert">Cert #</label><input id="f-cert" value="${esc(c.cert)}" inputmode="numeric" autocomplete="off"></div>
          <div class="field"><label for="f-variety">Variety</label><input id="f-variety" value="${esc(c.variety)}" placeholder="e.g. Double Waterline" autocomplete="off"></div>
        </div>
        <div class="field"><label for="f-comments">Comments on the cert</label><input id="f-comments" value="${esc(c.comments)}" placeholder="e.g. Cleaned, Full Red, Prooflike" autocomplete="off"></div>
        <div class="field"><span class="lab" id="st-lab">Status</span><div class="status-pick" role="radiogroup" aria-labelledby="st-lab">${Object.entries(STATUS).map(([k, s]) => `<label class="sp ${s.cls}"><input type="radio" name="status" id="f-st-${k}" value="${k}"${c.status === k ? " checked" : ""}><span>${s.label}</span></label>`).join("")}</div></div>
        <div class="listbox" id="list-sec"${c.status === "stock" ? "" : " hidden"}>
          <label class="inc"><input type="checkbox" id="f-listed"${c.listed ? " checked" : ""}><span>Listed for sale</span></label>
          <div class="list-fields grid" id="list-fields"${c.listed ? "" : " hidden"}>
            <div class="status-pick duo" role="radiogroup" aria-label="Kind of listing">
              <label class="sp stock"><input type="radio" name="lformat" id="f-lf-auction" value="auction"${lf === "auction" ? " checked" : ""}><span>Auction</span></label>
              <label class="sp stock"><input type="radio" name="lformat" id="f-lf-fixed" value="fixed"${lf === "fixed" ? " checked" : ""}><span>Fixed price</span></label>
            </div>
            <div class="grid2">
              <div class="field"><label for="f-listedon">Where</label><input id="f-listedon" list="dl-platforms" value="${esc(c.listedOn || "Facebook")}" autocomplete="off"></div>
              <div class="field"><label for="f-listeddate">Date listed</label><input id="f-listeddate" type="date" value="${esc(c.listedDate || "")}"></div>
              <div class="field"><label for="f-ask" id="f-ask-lab">${priceWord(lf)}</label><input id="f-ask" type="number" step="0.01" min="0" inputmode="decimal" value="${mv(c.askPrice)}" placeholder="${lf === "fixed" ? "0.00" : "No bids yet"}"></div>
              <div class="field" id="f-ends-f"${lf === "fixed" ? " hidden" : ""}><label for="f-ends">Auction ends</label><input id="f-ends" type="date" value="${esc(c.listEnds || "")}"></div>
            </div>
          </div>
          ${dl("dl-platforms", PLATFORMS.concat([...state.coins.values()].map(x => x.listedOn)))}
        </div>
      </section>
      <section class="sec">
        <h3 class="eyebrow">Purchase</h3>
        <div class="grid2">
          <div class="field"><label for="f-bought">Date paid</label><input id="f-bought" type="date" value="${esc(c.boughtOn)}"></div>
          <div class="field"><label for="f-source">Bought from</label><input id="f-source" list="dl-src" value="${esc(c.source)}" placeholder="Seller, show, auction" autocomplete="off"></div>
          <div class="field"><label for="f-cost">Price paid</label><input id="f-cost" type="number" step="0.01" min="0" inputmode="decimal" value="${mv(c.cost)}" placeholder="0.00"></div>
          <div class="field"><label for="f-buyfees">Fees, shipping, duty</label><input id="f-buyfees" type="number" step="0.01" min="0" inputmode="decimal" value="${mv(c.buyFees)}" placeholder="0.00"></div>
        </div>
        <div class="grid2"><div class="field"><label for="f-payfrom">Paid from</label>${paySel("f-payfrom", payFrom)}</div></div>
        <p class="hint">Amounts in Canadian dollars, as charged to you. Paying from Cash or EQ Bank takes it off that balance.</p>
      </section>
      <section class="sec">
        <h3 class="eyebrow">Grading</h3>
        ${sub ? `<p class="subinfo">Part of the ${esc(sub.company)}${sub.service ? " " + esc(sub.service) : ""} submission sent ${fmtDate(sub.sentOn)}${sub.status === "returned" ? ", returned " + fmtDate(sub.returnedOn) : ""}. Its cost here comes from that submission's total.</p>` : ""}
        <div class="grid2">
          <div class="field"><label for="f-gtier">ICCS service</label><select id="f-gtier"><option value="">Not ICCS, or custom</option>${ICCS_TIERS.map(([k, l, pr]) => `<option value="${k}"${c.gradeTier === k ? " selected" : ""}>${l} \u00b7 $${pr}</option>`).join("")}</select></div>
          <div class="field"><label for="f-gradecost">Grading cost for this coin</label><input id="f-gradecost" type="number" step="0.01" min="0" inputmode="decimal" value="${mv(c.gradeCost)}" placeholder="0.00"></div>
        </div>
        <p class="hint" id="f-ghint">${ICCS_HINT}</p>
      </section>
      <section class="sec" id="con-sec"${c.status === "consigned" ? "" : " hidden"}>
        <h3 class="eyebrow">Consignment</h3>
        <div class="grid2">
          <div class="field"><label for="f-consignee">Auction house</label><input id="f-consignee" list="dl-houses" value="${esc(c.consignee)}" placeholder="e.g. TCNC" autocomplete="off"></div>
          <div class="field"><label for="f-consignedon">Date consigned</label><input id="f-consignedon" type="date" value="${esc(c.consignedOn)}"></div>
          <div class="field"><label for="f-auction">Auction</label><input id="f-auction" value="${esc(c.auction)}" placeholder="Sale name or date" autocomplete="off"></div>
          <div class="field"><label for="f-lot">Lot #</label><input id="f-lot" value="${esc(c.lot)}" autocomplete="off"></div>
          <div class="field"><label for="f-commission">Seller's commission %</label><input id="f-commission" type="number" step="0.1" min="0" inputmode="decimal" value="${c.commission == null ? "" : esc(String(c.commission))}" placeholder="e.g. 10"></div>
        </div>
        <p class="hint">When it sells, mark it Sold. The auction house becomes the buyer, waiting for payment, and its commission becomes the selling fee.</p>
      </section>
      <section class="sec" id="sale-sec"${c.status === "sold" ? "" : " hidden"}>
        <h3 class="eyebrow">Sale</h3>
        <div class="grid2">
          <div class="field"><label for="f-soldon">Date sold</label><input id="f-soldon" type="date" value="${esc(c.soldOn)}"></div>
          <div class="field"><label for="f-soldvia">Sold through</label><input id="f-soldvia" list="dl-via" value="${esc(c.soldVia)}" placeholder="eBay, show, private" autocomplete="off"></div>
          <div class="field"><label for="f-buyer">Buyer</label><input id="f-buyer" list="dl-buyers" value="${esc(c.buyer)}" placeholder="Name or handle" autocomplete="off"></div>
        </div>
        <div class="grid3">
          <div class="field"><label for="f-saleprice">Sale price</label><input id="f-saleprice" type="number" step="0.01" min="0" inputmode="decimal" value="${mv(c.salePrice)}" placeholder="0.00"></div>
          <div class="field"><label for="f-salefees">Selling fees</label><input id="f-salefees" type="number" step="0.01" min="0" inputmode="decimal" value="${mv(c.saleFees)}" placeholder="0.00"></div>
          <div class="field"><label for="f-ship">Shipping</label><input id="f-ship" type="number" step="0.01" min="0" inputmode="decimal" value="${mv(c.shipCost)}" placeholder="0.00"></div>
        </div>
        <div class="field"><span class="lab" id="pay-lab">Payment</span><div class="status-pick duo" role="radiogroup" aria-labelledby="pay-lab">
          <label class="sp stock"><input type="radio" name="paid" id="f-paid-yes" value="yes"${unpaid ? "" : " checked"}><span>Paid</span></label>
          <label class="sp in"><input type="radio" name="paid" id="f-paid-no" value="no"${unpaid ? " checked" : ""}><span>Waiting for payment</span></label>
        </div></div>
        <div class="grid2" id="paid-fields"${unpaid ? " hidden" : ""}>
          <div class="field"><label for="f-paidon">Date paid</label><input id="f-paidon" type="date" value="${esc(c.paidOn || "")}"></div>
          <div class="field"><label for="f-payto">Money went into</label>${paySel("f-payto", payTo)}</div>
        </div>
        <p class="hint" id="pay-hint">${unpaid ? PAY_HINT_NO : PAY_HINT_YES}</p>
      </section>
      <section class="sec">
        <h3 class="eyebrow">Notes</h3>
        <div class="field"><textarea id="f-notes" aria-label="Notes" rows="3" placeholder="Variety, pedigree, where it's stored">${esc(c.notes)}</textarea></div>
      </section>
      ${dl("dl-grades", GRADES)}${dl("dl-src", sources)}${dl("dl-via", vias)}${dl("dl-buyers", buyers)}${dl("dl-houses", HOUSES.concat([...state.coins.values()].map(x => x.consignee)))}
    </div>
    <footer class="sh-foot gut" id="sh-foot">${footHTML(!!src)}</footer>
  </form>`;
  const kpis = () => {
    const f = panel.querySelector("#coin-form"); if (!f) return;
    const g = i => f.querySelector("#" + i).value;
    const st = (f.querySelector("input[name=status]:checked") || {}).value;
    const b = num(num(g("f-cost")) + num(g("f-buyfees")) + num(g("f-gradecost")));
    const sold = st === "sold", ns = num(num(g("f-saleprice")) - num(g("f-salefees")) - num(g("f-ship")));
    f.querySelector("#coin-kpis").innerHTML = `<div><span class="lab">Cost basis</span><span class="fig">${fmt(b)}</span></div><div><span class="lab">Net from sale</span><span class="fig">${sold ? fmt(ns) : "—"}</span></div><div><span class="lab">Profit</span><span class="fig ${sold ? (ns - b < 0 ? "neg" : "pos") : ""}">${sold ? fmtSigned(ns - b) : "—"}</span></div>`;
  };
  const gradeFill = () => {
    const f = panel.querySelector("#coin-form"); if (!f) return;
    const k = f.querySelector("#f-gtier").value, t = iccsTier(k), h = f.querySelector("#f-ghint");
    if (!t){ h.textContent = ICCS_HINT; return; }
    const tot = iccsCost(k);
    f.querySelector("#f-gradecost").value = tot.toFixed(2);
    h.textContent = t[1] + ": " + fmt(t[2]) + " + " + fmt(num(tot - t[2])) + " HST = " + fmt(tot);
    kpis();
  };
  openSheet(html, {
    what: "coin",
    onInput(e){
      const f = panel.querySelector("#coin-form"), id = e.target.id;
      if (f && id === "f-salefees") e.target.dataset.auto = "0";
      if (f && (id === "f-saleprice" || id === "f-commission")){
        const fees = f.querySelector("#f-salefees"), rate = num(f.querySelector("#f-commission").value), price = num(f.querySelector("#f-saleprice").value);
        if (rate > 0 && f.querySelector("#f-consignee").value.trim() && (fees.dataset.auto === "1" || !fees.value)){ fees.value = price ? num(price * rate / 100).toFixed(2) : ""; fees.dataset.auto = "1"; }
      }
      kpis();
    },
    onAction(a){
      if (a === "cert-stop"){ if (state.sheet && state.sheet.certCtl) state.sheet.certCtl.abort(); }
      else if (a === "cert-use") certUseLabel();
    },
    onClose(){ if (this.certCtl) this.certCtl.abort(); },
    onChange(e){
      if (e.target.id === "f-certphoto"){ const file = e.target.files && e.target.files[0]; e.target.value = ""; if (file) readCertInto(file); return; }
      if (e.target.id === "f-gtier"){ gradeFill(); return; }
      if (e.target.name === "paid"){
        const yes = e.target.value === "yes";
        panel.querySelector("#paid-fields").hidden = !yes;
        panel.querySelector("#pay-hint").textContent = yes ? PAY_HINT_YES : PAY_HINT_NO;
        const po = panel.querySelector("#f-paidon"); if (yes && !po.value && src && src.paid === false) po.value = todayStr();
        return;
      }
      if (e.target.name === "lformat"){
        const fixed = e.target.value === "fixed";
        panel.querySelector("#f-ask-lab").textContent = priceWord(e.target.value);
        panel.querySelector("#f-ask").placeholder = fixed ? "0.00" : "No bids yet";
        panel.querySelector("#f-ends-f").hidden = fixed;
        return;
      }
      if (e.target.id === "f-listed"){
        panel.querySelector("#list-fields").hidden = !e.target.checked;
        const ld = panel.querySelector("#f-listeddate"); if (e.target.checked && !ld.value) ld.value = todayStr();
        return;
      }
      if (e.target.name === "status"){
        const sold = e.target.value === "sold", con = e.target.value === "consigned", f = panel.querySelector("#coin-form");
        panel.querySelector("#list-sec").hidden = e.target.value !== "stock";
        // selling a listed coin: it sold where it was listed, at the asking price unless you change it
        if (sold && src && isListed(src)){
          const via = f.querySelector("#f-soldvia"), sp = f.querySelector("#f-saleprice");
          if (!via.value && src.listedOn) via.value = src.listedOn;
          if (!sp.value && src.askPrice) sp.value = src.askPrice;
        }
        panel.querySelector("#sale-sec").hidden = !sold;
        panel.querySelector("#con-sec").hidden = !con;
        const so = panel.querySelector("#f-soldon"); if (sold && !so.value) so.value = todayStr();
        const co = f.querySelector("#f-consignedon"); if (con && !co.value) co.value = todayStr();
        // selling a consigned coin: the auction house is the buyer and usually pays later
        const house = f.querySelector("#f-consignee").value.trim();
        if (sold && house && src && src.status === "consigned"){
          const via = f.querySelector("#f-soldvia"), by = f.querySelector("#f-buyer");
          if (!via.value) via.value = house + " auction";
          if (!by.value) by.value = house;
          const no = f.querySelector("#f-paid-no"); if (no && !no.checked){ no.checked = true; no.dispatchEvent(new Event("change", {bubbles: true})); }
        }
        kpis();
      }
    },
    onSubmit(f){
      const g = i => f.querySelector("#" + i);
      const name = g("f-name").value.trim();
      if (!name){ g("f-name").setAttribute("aria-invalid", "true"); g("f-name").focus(); toast("Give the coin a name."); return; }
      const status = (f.querySelector("input[name=status]:checked") || {}).value || "stock";
      const doc = Object.assign({}, src || {}, {
        name, grader: g("f-grader").value, grade: g("f-grade").value.trim(), cert: g("f-cert").value.trim(),
        variety: g("f-variety").value.trim(), comments: g("f-comments").value.trim(), status,
        boughtOn: g("f-bought").value, source: g("f-source").value.trim(), cost: num(g("f-cost").value), buyFees: num(g("f-buyfees").value),
        gradeCost: num(g("f-gradecost").value), gradeTier: g("f-gtier").value,
        soldOn: status === "sold" ? (g("f-soldon").value || todayStr()) : g("f-soldon").value,
        soldVia: g("f-soldvia").value.trim(), salePrice: num(g("f-saleprice").value), saleFees: num(g("f-salefees").value), shipCost: num(g("f-ship").value),
        buyer: g("f-buyer").value.trim(),
        listed: status === "stock" && g("f-listed").checked, listedOn: g("f-listedon").value.trim(), listedDate: g("f-listeddate").value, askPrice: num(g("f-ask").value),
        listFormat: (f.querySelector("input[name=lformat]:checked") || {}).value || "auction", listEnds: g("f-ends").value,
        consignee: g("f-consignee").value.trim(), consignedOn: g("f-consignedon").value || (status === "consigned" ? todayStr() : ""),
        auction: g("f-auction").value.trim(), lot: g("f-lot").value.trim(), commission: g("f-commission").value === "" ? "" : num(g("f-commission").value),
        payFrom: g("f-payfrom").value, payTo: g("f-payto").value,
        notes: g("f-notes").value.trim(), subId: (src && src.subId) || "", updated: nowIso()
      });
      if (!src) doc.created = nowIso();
      const paidYes = (f.querySelector("input[name=paid]:checked") || {}).value !== "no";
      if (status === "sold"){ doc.paid = paidYes; doc.paidOn = paidYes ? (g("f-paidon").value || doc.soldOn) : ""; }
      else { delete doc.paid; doc.paidOn = ""; }
      if (doc.listed) store.set("listFormat", doc.listFormat);
      if (!src) store.set("payFrom", doc.payFrom); if (status === "sold" && paidYes) store.set("payTo", doc.payTo);
      guarded(async () => { const cid = id || newId("coins"); await runWrites([["set", "coins", cid, doc]]); closeSheet(); toast(src ? "Coin saved" : "Coin added"); });
    },
    onDelete(){ guarded(async () => { await runWrites([["del", "coins", id]]); closeSheet(); toast("Coin deleted"); }); }
  }, src ? (preset && preset.status === "sold" ? "#f-saleprice" : null) : "#f-name");
  kpis();
  if (c.gradeTier) gradeFillHint();
  function gradeFillHint(){
    const f = panel.querySelector("#coin-form"); if (!f) return;
    const k = f.querySelector("#f-gtier").value, t = iccsTier(k);
    if (t){ const tot = iccsCost(k); f.querySelector("#f-ghint").textContent = t[1] + ": " + fmt(t[2]) + " + " + fmt(num(tot - t[2])) + " HST = " + fmt(tot); }
  }
}

/* fill a coin's details from a photo of its cert or slab label */
function certPrompt(){
  return `You're reading the label of a graded coin holder (slab) or its paper certificate, for a Canadian coin dealer's inventory. The photo may show the whole holder, just the label, or the certificate.
Reply with only a JSON object in this shape:
{"grader":"PCGS"|"NGC"|"CGC"|"ICCS"|"CCCS"|"Other"|null,"grade":string|null,"cert":string|null,"name":string|null,"variety":string|null,"comments":string|null,"pedigree":string|null}
- name: year, mint mark, denomination and variety, short, the way a Canadian collector writes it: "1955 Arnprior $1", "1947 Maple Leaf 1¢", "1936 Dot 10¢". Use ¢ for cents and $ for dollars. Add the country only when it isn't Canada.
- grade: as printed, with designations: "MS-64 RD", "AU-55", "PL-65 Heavy Cameo". Include a colour designation printed separately, such as Red or Red Brown.
- cert: the certification number as printed. On ICCS labels it follows "Certification No.". On PCGS and NGC labels use the printed cert number.
- variety: the variety or attribution printed on the label, such as "Double Waterline", "Dot", "Near Leaf", "Short Water Lines" or a die variety number. null if none.
- comments: everything printed in the label's comments or designation area that isn't the grade, variety or pedigree, as printed. On ICCS labels and certificates this is the Comments line, for example "Cleaned", "Light Scratches", "Full Red", "Prooflike", "Full Bridge". On PCGS and NGC labels include designations and notes such as "Genuine - Cleaned", "First Strike" or "Pop Top". Join several with " \u00b7 ". null if none.
- pedigree: a pedigree or collection name if one is printed.
Use null for anything you can't read with certainty. Never guess digits.`;
}
function normCertRead(raw){
  const r = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  const S = v => v == null ? "" : String(v).trim();
  const gr = S(r.grader), grader = gr ? (GRADERS.find(x => x.toLowerCase() === gr.toLowerCase()) || "Other") : "";
  const comments = [S(r.comments), S(r.pedigree) ? "Pedigree: " + S(r.pedigree) : ""].filter(Boolean).join(" \u00b7 ");
  const d = {name: S(r.name), grader: grader === "Raw" ? "" : grader, grade: S(r.grade), cert: S(r.cert).replace(/\s+/g, " "), variety: S(r.variety), comments};
  return Object.values(d).some(Boolean) ? d : null;
}
async function readCertInto(file){
  const f = panel.querySelector("#coin-form"), out = f && f.querySelector("#f-certout");
  if (!f || !out || !state.sample || !state.sheet) return;
  const ctx = state.sheet;
  if (ctx.certCtl) ctx.certCtl.abort();
  const ctl = new AbortController(); ctx.certCtl = ctl;
  out.innerHTML = `<div class="certread"><span class="spin sm" aria-hidden="true"></span><span>Reading the label…</span><button type="button" class="linkbtn sm" data-sh="cert-stop">Stop</button></div>`;
  let d = null;
  try {
    let local = null;
    if (Platform.readLabel){ try { local = await Platform.readLabel(file); } catch(e){ local = null; } }
    if (ctl.signal.aborted) throw {code: "cancelled"};
    const canAsk = !Platform.canAsk || Platform.canAsk();
    if (local && (local.found >= 3 || !canAsk)) d = local.label;
    else {
      const img = await prepImage(file);
      const raw = await state.sample.json(certPrompt(), {images: [img], signal: ctl.signal});
      d = normCertRead(raw);
    }
  } catch(e){
    if (state.sheet !== ctx || ctx.certCtl !== ctl) return;
    ctx.certCtl = null;
    out.innerHTML = e && e.code === "cancelled" ? "" : `<div class="note warn" role="alert"><p>${esc(e && e.code ? scanErr(e) : "That photo couldn't be opened. Try another one.")}</p></div>`;
    if (e && ["not_granted", "sampling_disabled", "not_declared", "capability_disabled", "capability_removed", "images_unavailable"].includes(e.code)) state.sample = null;
    return;
  }
  if (state.sheet !== ctx || ctx.certCtl !== ctl) return;
  ctx.certCtl = null;
  if (!d){ out.innerHTML = `<div class="note warn" role="alert"><p>No label details were found in that photo. Try a closer, sharper shot of the label.</p></div>`; return; }
  const norm = v => String(v || "").toLowerCase().replace(/[\s\-·.]+/g, "");
  const fields = [["name", "f-name", "coin name"], ["grader", "f-grader", "grader"], ["grade", "f-grade", "grade"], ["cert", "f-cert", "cert number"], ["variety", "f-variety", "variety"], ["comments", "f-comments", "comments"]];
  const filled = [], diffs = [];
  for (const [key, id, label] of fields){
    const val = d[key]; if (!val) continue;
    const el = f.querySelector("#" + id), cur = el.value.trim();
    if (!cur || (key === "grader" && cur === "Raw")){ el.value = val; filled.push(label); }
    else if (norm(cur) !== norm(val)) diffs.push({id, label, cur, val});
  }
  ctx.certDiffs = diffs;
  const list = a => a.length < 2 ? a.join("") : a.slice(0, -1).join(", ") + " and " + a[a.length - 1];
  const status = (f.querySelector("input[name=status]:checked") || {}).value;
  out.innerHTML = `<div class="certdiff">
    <p>${filled.length ? "Filled in the " + esc(list(filled)) + " from the label." : "Nothing was missing."}${diffs.length || filled.length ? " Save to keep the changes." : ""}</p>
    ${diffs.length ? `<p class="muted sm">The label reads differently for:</p><ul>${diffs.map(x => `<li><b>${esc(x.label[0].toUpperCase() + x.label.slice(1))}:</b> ${esc(x.val)} <span class="muted">(you have ${esc(x.cur)})</span></li>`).join("")}</ul><div><button type="button" class="btn small" data-sh="cert-use">Use the label's details</button></div>` : ""}
    ${status === "grading" ? `<p class="muted sm">Back from grading? Choose In stock below.</p>` : ""}
  </div>`;
  const kp = f.querySelector("#coin-kpis"); if (kp) f.dispatchEvent(new Event("input", {bubbles: true}));
}
function certUseLabel(){
  const f = panel.querySelector("#coin-form"), ctx = state.sheet;
  if (!f || !ctx || !ctx.certDiffs) return;
  for (const x of ctx.certDiffs){ const el = f.querySelector("#" + x.id); if (el) el.value = x.val; }
  ctx.certDiffs = [];
  const out = f.querySelector("#f-certout");
  if (out) out.innerHTML = `<div class="certdiff"><p>Updated to the label's details. Save to keep the changes.</p></div>`;
}

/* mark several in-stock coins listed for sale */
function openListing(){
  const eligible = [...state.coins.entries()].filter(([, c]) => c.status === "stock")
    .sort((a, b) => (isListed(b[1]) - isListed(a[1])) || String(a[1].name).localeCompare(String(b[1].name)));
  const html = `<form class="sheet-form" id="lst-form" novalidate>
    <header class="sh-head gut"><h2 id="sh-title">Listed for sale</h2><button type="button" class="x" data-sh="close" aria-label="Close">✕</button></header>
    <div class="sh-body gut">
      <section class="sec">
        <div class="grid2">
          <div class="field"><label for="l-where">Where</label><input id="l-where" list="dl-platforms" value="Facebook" autocomplete="off"></div>
          <div class="field"><label for="l-date">Date listed</label><input id="l-date" type="date" value="${todayStr()}"></div>
        </div>
        <div class="status-pick duo" role="radiogroup" aria-label="Kind of listing">
          <label class="sp stock"><input type="radio" name="lformat" id="l-lf-auction" value="auction"${lastFormat() === "auction" ? " checked" : ""}><span>Auction</span></label>
          <label class="sp stock"><input type="radio" name="lformat" id="l-lf-fixed" value="fixed"${lastFormat() === "fixed" ? " checked" : ""}><span>Fixed price</span></label>
        </div>
        <div class="field" id="l-ends-f"${lastFormat() === "fixed" ? " hidden" : ""}><label for="l-ends">Auction ends</label><input id="l-ends" type="date"></div>
        <p class="hint">Tick the coins that are listed. You can note the current bid as it changes. Untick a coin that's no longer listed. Coins already listed keep their original date.</p>
        ${dl("dl-platforms", PLATFORMS.concat([...state.coins.values()].map(x => x.listedOn)))}
      </section>
      <section class="sec">
        <div class="block-head"><h3 class="eyebrow">In-stock coins</h3><span class="split" id="l-count"></span></div>
        ${eligible.length > 6 ? `<input type="search" id="l-q" placeholder="Filter coins" aria-label="Filter coins" autocomplete="off">` : ""}
        <div>${eligible.map(([cid, c]) => `<div class="chk" data-q="${esc([c.name, c.grade, c.cert, c.grader, c.variety].join(" ").toLowerCase())}">
          <input type="checkbox" id="l-ck-${esc(cid)}" value="${esc(cid)}"${isListed(c) ? " checked" : ""}>
          <label for="l-ck-${esc(cid)}"><span class="row-title">${esc(c.name)}${exTag(c)}</span><span class="row-sub">${esc(gradeLine(c))}${c.cert ? " · #" + esc(c.cert) : ""} · cost ${fmt(basis(c))}${isListed(c) && c.listedOn ? " · on " + esc(c.listedOn) : ""}</span></label>
          <div class="field ask"><label for="l-a-${esc(cid)}" class="l-pw">${priceWord(lastFormat())}</label><input id="l-a-${esc(cid)}" type="number" step="0.01" min="0" inputmode="decimal" value="${mv(c.askPrice)}" placeholder="${lastFormat() === "fixed" ? "Optional" : "No bids yet"}"></div>
        </div>`).join("") || `<p class="muted sm">No coins are in stock right now.</p>`}</div>
      </section>
    </div>
    <footer class="sh-foot gut" id="sh-foot"><span class="grow"></span><button type="button" class="btn ghost" data-sh="close">Cancel</button><button type="submit" class="btn primary" id="sh-save">Save</button></footer>
  </form>`;
  const count = () => {
    const f = panel.querySelector("#lst-form"); if (!f) return;
    const n = f.querySelectorAll('input[id^="l-ck-"]:checked').length;
    f.querySelector("#l-count").textContent = plural(n, "coin") + " listed";
  };
  openSheet(html, {
    what: "listing",
    onInput(e){ if (e.target.id === "l-q"){ const q = e.target.value.trim().toLowerCase(); panel.querySelectorAll("#lst-form .chk").forEach(el => { el.hidden = !!q && !el.dataset.q.includes(q); }); } count(); },
    onChange(e){
      if (e.target.name === "lformat"){
        const fixed = e.target.value === "fixed";
        panel.querySelectorAll("#lst-form .l-pw").forEach(el => { el.textContent = priceWord(e.target.value); });
        panel.querySelectorAll('#lst-form input[id^="l-a-"]').forEach(el => { el.placeholder = fixed ? "Optional" : "No bids yet"; });
        panel.querySelector("#l-ends-f").hidden = fixed;
      }
      count();
    },
    onSubmit(f){
      const where = f.querySelector("#l-where").value.trim() || "Facebook", date = f.querySelector("#l-date").value || todayStr(), now = nowIso();
      const format = (f.querySelector("input[name=lformat]:checked") || {}).value || "auction", ends = format === "auction" ? f.querySelector("#l-ends").value : "";
      store.set("listFormat", format);
      const writes = [];
      for (const [cid, c] of eligible){
        const on = f.querySelector("#l-ck-" + CSS.escape(cid)).checked, ask = num(f.querySelector("#l-a-" + CSS.escape(cid)).value);
        if (on){
          const next = Object.assign({}, c, {listed: true, listedOn: isListed(c) && c.listedOn ? c.listedOn : where, listedDate: isListed(c) && c.listedDate ? c.listedDate : date, askPrice: ask,
            listFormat: isListed(c) && c.listFormat ? c.listFormat : format, listEnds: isListed(c) && c.listEnds ? c.listEnds : ends});
          if (JSON.stringify(next) !== JSON.stringify(c)) writes.push(["set", "coins", cid, Object.assign(next, {updated: now})]);
        } else if (isListed(c)) writes.push(["set", "coins", cid, Object.assign({}, c, {listed: false, updated: now})]);
      }
      if (!writes.length){ closeSheet(); return; }
      guarded(async () => { await runWrites(writes); closeSheet(); toast("Updated " + plural(writes.length, "coin")); });
    }
  }, null);
  count();
}

/* consign several coins to an auction house */
function openConsign(house){
  house = house || "";
  const inGroup = c => c.status === "consigned" && houseKey(c) === house && !!house;
  const eligible = [...state.coins.entries()].filter(([, c]) => c.status === "stock" || inGroup(c))
    .sort((a, b) => (inGroup(b[1]) - inGroup(a[1])) || String(a[1].name).localeCompare(String(b[1].name)));
  const first = eligible.map(x => x[1]).find(inGroup) || {};
  const html = `<form class="sheet-form" id="con-form" novalidate>
    <header class="sh-head gut"><h2 id="sh-title">Consign coins</h2><button type="button" class="x" data-sh="close" aria-label="Close">✕</button></header>
    <div class="sh-body gut">
      <section class="sec">
        <div class="grid2">
          <div class="field"><label for="k-house">Auction house</label><input id="k-house" list="dl-houses" value="${esc(house)}" placeholder="e.g. TCNC" autocomplete="off"></div>
          <div class="field"><label for="k-date">Date consigned</label><input id="k-date" type="date" value="${esc(first.consignedOn || todayStr())}"></div>
          <div class="field"><label for="k-auction">Auction</label><input id="k-auction" value="${esc(first.auction || "")}" placeholder="Sale name or date" autocomplete="off"></div>
          <div class="field"><label for="k-comm">Seller's commission %</label><input id="k-comm" type="number" step="0.1" min="0" inputmode="decimal" value="${first.commission == null ? "" : esc(String(first.commission))}" placeholder="e.g. 10"></div>
        </div>
        ${dl("dl-houses", HOUSES.concat([...state.coins.values()].map(x => x.consignee)))}
      </section>
      <section class="sec">
        <div class="block-head"><h3 class="eyebrow">Coins to consign</h3><span class="split" id="k-count"></span></div>
        ${eligible.length > 6 ? `<input type="search" id="k-q" placeholder="Filter coins" aria-label="Filter coins" autocomplete="off">` : ""}
        <div>${eligible.map(([cid, c]) => `<div class="chk" data-q="${esc([c.name, c.grade, c.cert, c.grader, c.variety].join(" ").toLowerCase())}">
          <input type="checkbox" id="k-ck-${esc(cid)}" value="${esc(cid)}"${inGroup(c) ? " checked" : ""}>
          <label for="k-ck-${esc(cid)}"><span class="row-title">${esc(c.name)}${exTag(c)}</span><span class="row-sub">${esc(gradeLine(c))}${c.cert ? " · #" + esc(c.cert) : ""} · cost ${fmt(basis(c))}</span></label>
        </div>`).join("") || `<p class="muted sm">No coins are in stock. Coins need to be In stock to consign them.</p>`}</div>
      </section>
    </div>
    <footer class="sh-foot gut" id="sh-foot"><span class="grow"></span><button type="button" class="btn ghost" data-sh="close">Cancel</button><button type="submit" class="btn primary" id="sh-save">Consign</button></footer>
  </form>`;
  const count = () => {
    const f = panel.querySelector("#con-form"); if (!f) return;
    const n = f.querySelectorAll('input[id^="k-ck-"]:checked').length;
    f.querySelector("#k-count").textContent = plural(n, "coin");
    const b = f.querySelector("#sh-save"); b.textContent = n ? "Consign " + plural(n, "coin") : "Consign"; b.disabled = !n && !house;
  };
  openSheet(html, {
    what: "consignment",
    onInput(e){ if (e.target.id === "k-q"){ const q = e.target.value.trim().toLowerCase(); panel.querySelectorAll("#con-form .chk").forEach(el => { el.hidden = !!q && !el.dataset.q.includes(q); }); } count(); },
    onChange: count,
    onSubmit(f){
      const g = i => f.querySelector("#" + i);
      const h = g("k-house").value.trim();
      if (!h){ g("k-house").setAttribute("aria-invalid", "true"); g("k-house").focus(); toast("Name the auction house."); return; }
      const ids = [...f.querySelectorAll('input[id^="k-ck-"]:checked')].map(x => x.value), now = nowIso();
      const date = g("k-date").value || todayStr(), auction = g("k-auction").value.trim(), comm = g("k-comm").value === "" ? "" : num(g("k-comm").value);
      const writes = [];
      for (const [cid, c] of eligible){
        const on = ids.includes(cid);
        if (on) writes.push(["set", "coins", cid, Object.assign({}, c, {status: "consigned", consignee: h, consignedOn: inGroup(c) && c.consignedOn ? c.consignedOn : date, auction: auction || c.auction || "", commission: comm === "" ? (c.commission == null ? "" : c.commission) : comm, updated: now})]);
        else if (inGroup(c)) writes.push(["set", "coins", cid, Object.assign({}, c, {status: "stock", updated: now})]);
      }
      if (!writes.length){ closeSheet(); return; }
      guarded(async () => { await runWrites(writes); closeSheet(); toast(ids.length ? "Consigned " + plural(ids.length, "coin") + " to " + h : "Updated"); });
    }
  }, null);
  count();
}

/* record what sold at auction */
function openConsignResults(house){
  const items = [...state.coins.entries()].filter(([, c]) => c.status === "consigned" && houseKey(c) === house)
    .sort((a, b) => String(a[1].lot || "").localeCompare(String(b[1].lot || ""), undefined, {numeric: true}) || String(a[1].name).localeCompare(String(b[1].name)));
  if (!items.length){ toast("No coins are consigned to " + (house || "that auction house") + "."); return; }
  const comm0 = (items.map(x => x[1].commission).find(v => v !== "" && v != null));
  const html = `<form class="sheet-form" id="res-form" novalidate>
    <header class="sh-head gut"><h2 id="sh-title">Auction results</h2><button type="button" class="x" data-sh="close" aria-label="Close">✕</button></header>
    <div class="sh-body gut">
      <section class="sec">
        <p><b>${esc(house || "Auction house not named")}</b> <span class="muted">· ${plural(items.length, "coin")} consigned</span></p>
        <p class="hint">Enter the hammer price for each coin that sold. Leave it blank if it's still waiting, or tick Returned if it came back unsold.</p>
        <div>${items.map(([cid, c]) => `<div class="rres">
          <span class="row-main"><span class="row-title">${esc(c.name)}${exTag(c)}</span><span class="row-sub">${esc([c.lot ? "Lot " + c.lot : "", c.auction, "cost " + fmt(basis(c))].filter(Boolean).join(" · "))}</span></span>
          <div class="field"><label for="r-p-${esc(cid)}">Sold for</label><input id="r-p-${esc(cid)}" type="number" step="0.01" min="0" inputmode="decimal" placeholder="0.00"></div>
          <label class="inc"><input type="checkbox" id="r-r-${esc(cid)}"><span>Returned unsold</span></label>
        </div>`).join("")}</div>
      </section>
      <section class="sec">
        <div class="grid2">
          <div class="field"><label for="r-date">Date sold</label><input id="r-date" type="date" value="${todayStr()}"></div>
          <div class="field"><label for="r-comm">Seller's commission %</label><input id="r-comm" type="number" step="0.1" min="0" inputmode="decimal" value="${comm0 == null ? "" : esc(String(comm0))}" placeholder="0"></div>
        </div>
        <div class="field"><span class="lab" id="rpay-lab">Payment from ${esc(house || "the auction house")}</span><div class="status-pick duo" role="radiogroup" aria-labelledby="rpay-lab">
          <label class="sp in"><input type="radio" name="rpaid" id="r-paid-no" value="no" checked><span>Waiting for payment</span></label>
          <label class="sp stock"><input type="radio" name="rpaid" id="r-paid-yes" value="yes"><span>Paid</span></label>
        </div></div>
        <div class="grid2" id="r-paid-fields" hidden>
          <div class="field"><label for="r-paidon">Date paid</label><input id="r-paidon" type="date" value="${todayStr()}"></div>
          <div class="field"><label for="r-payto">Money went into</label>${paySel("r-payto", lastPay("payTo"))}</div>
        </div>
        <div class="card stmt" id="r-sum"></div>
      </section>
    </div>
    <footer class="sh-foot gut" id="sh-foot"><button type="button" class="btn ghost" data-sh="r-more">Consign more</button><span class="grow"></span><button type="button" class="btn ghost" data-sh="close">Cancel</button><button type="submit" class="btn primary" id="sh-save">Save results</button></footer>
  </form>`;
  const plan = f => {
    const rate = num(f.querySelector("#r-comm").value);
    const sold = [], back = [];
    for (const [cid, c] of items){
      const price = num((f.querySelector("#r-p-" + CSS.escape(cid)) || {}).value);
      if ((f.querySelector("#r-r-" + CSS.escape(cid)) || {}).checked) back.push([cid, c]);
      else if (price > 0) sold.push([cid, c, price, num(price * rate / 100)]);
    }
    return {rate, sold, back};
  };
  const update = () => {
    const f = panel.querySelector("#res-form"); if (!f) return;
    const P = plan(f), hammer = sum(P.sold, x => x[2]), fees = sum(P.sold, x => x[3]);
    const paid = (f.querySelector("input[name=rpaid]:checked") || {}).value === "yes";
    f.querySelector("#r-paid-fields").hidden = !paid;
    f.querySelector("#r-sum").innerHTML = `
      <div class="sl"><span class="lbl">Sold<small>${plural(P.sold.length, "coin")}</small></span><span class="fig">${fmt(hammer)}</span></div>
      <div class="sl"><span class="lbl">Commission<small>${P.rate || 0}%</small></span><span class="fig">${fmtNeg(fees)}</span></div>
      <div class="sl total"><span class="lbl">${paid ? "Received" : "Owed by " + esc(house || "the auction house")}</span><span class="fig">${fmt(num(hammer - fees))}</span></div>
      ${P.back.length ? `<div class="sl minor"><span class="lbl">Back in stock</span><span class="fig">${plural(P.back.length, "coin")}</span></div>` : ""}`;
    const b = f.querySelector("#sh-save"); b.disabled = !P.sold.length && !P.back.length;
    b.textContent = P.sold.length ? "Record " + plural(P.sold.length, "sale") : (P.back.length ? "Return " + plural(P.back.length, "coin") : "Save results");
  };
  openSheet(html, {
    what: "results",
    onInput: update,
    onChange: update,
    onAction(a){ if (a === "r-more"){ closeSheet(); openConsign(house); } },
    onSubmit(f){
      const P = plan(f); if (!P.sold.length && !P.back.length) return;
      const date = f.querySelector("#r-date").value || todayStr(), now = nowIso();
      const paid = (f.querySelector("input[name=rpaid]:checked") || {}).value === "yes";
      const paidOn = f.querySelector("#r-paidon").value || date, payTo = f.querySelector("#r-payto").value;
      const writes = [];
      for (const [cid, c, price, fee] of P.sold) writes.push(["set", "coins", cid, Object.assign({}, c, {
        status: "sold", soldOn: date, soldVia: (house ? house + " auction" : "Auction") + (c.auction ? " · " + c.auction : ""), buyer: house,
        salePrice: price, saleFees: fee, shipCost: c.shipCost || 0, commission: P.rate,
        paid, paidOn: paid ? paidOn : "", payTo: paid ? payTo : (c.payTo || ""), updated: now
      })]);
      for (const [cid, c] of P.back) writes.push(["set", "coins", cid, Object.assign({}, c, {status: "stock", updated: now})]);
      if (paid) store.set("payTo", payTo);
      guarded(async () => { await runWrites(writes); closeSheet(); toast([P.sold.length ? "Recorded " + plural(P.sold.length, "sale") : "", P.back.length ? plural(P.back.length, "coin") + " back in stock" : ""].filter(Boolean).join(", ")); });
    }
  }, null);
  update();
}

/* collect payment for a buyer's unpaid coins */
function openCollect(buyer){
  const items = [...state.coins.entries()].filter(([, c]) => isUnpaid(c) && buyerKey(c) === buyer).sort((a, b) => (a[1].soldOn || "").localeCompare(b[1].soldOn || ""));
  if (!items.length){ toast("Nothing is waiting for payment from " + buyerLabel(buyer) + "."); return; }
  const html = `<form class="sheet-form" id="pay-form" novalidate>
    <header class="sh-head gut"><h2 id="sh-title">Collect payment</h2><button type="button" class="x" data-sh="close" aria-label="Close">✕</button></header>
    <div class="sh-body gut">
      <section class="sec">
        <p><b>${esc(buyerLabel(buyer))}</b> <span class="muted">· ${plural(items.length, "coin")} waiting for payment</span></p>
        <div>${items.map(([id, c]) => `<div class="chk">
          <input type="checkbox" id="p-ck-${esc(id)}" value="${esc(id)}" checked>
          <label for="p-ck-${esc(id)}"><span class="row-title">${esc(c.name)}${exTag(c)}</span><span class="row-sub">Sold ${fmtShort(c.soldOn)}${c.soldVia ? " · " + esc(c.soldVia) : ""} · <span class="fig">${fmt(c.salePrice)}</span></span></label>
        </div>`).join("")}</div>
      </section>
      <section class="sec">
        <div class="grid2">
          <div class="field"><label for="p-date">Date paid</label><input id="p-date" type="date" value="${todayStr()}"></div>
          <div class="field"><label for="p-payto">Money went into</label>${paySel("p-payto", lastPay("payTo"))}</div>
        </div>
        <div class="card stmt" id="p-sum"></div>
      </section>
    </div>
    <footer class="sh-foot gut" id="sh-foot"><span class="grow"></span><button type="button" class="btn ghost" data-sh="close">Cancel</button><button type="submit" class="btn primary" id="sh-save">Mark paid</button></footer>
  </form>`;
  const picked = f => items.filter(([id]) => (f.querySelector("#p-ck-" + CSS.escape(id)) || {}).checked);
  const update = () => {
    const f = panel.querySelector("#pay-form"); if (!f) return;
    const sel = picked(f), owed = sum(sel, ([, c]) => c.salePrice), net = sum(sel, ([, c]) => netSale(c));
    const acct = ACCT_NAME[f.querySelector("#p-payto").value];
    f.querySelector("#p-sum").innerHTML = `
      <div class="sl"><span class="lbl">Paid by ${esc(buyerLabel(buyer))}<small>${plural(sel.length, "coin")}</small></span><span class="fig">${fmt(owed)}</span></div>
      ${num(owed - net) ? `<div class="sl"><span class="lbl">Selling fees and shipping</span><span class="fig">${fmtNeg(num(owed - net))}</span></div>` : ""}
      <div class="sl total"><span class="lbl">${isAcct(f.querySelector("#p-payto").value) ? "Added to " + acct : "Received"}</span><span class="fig">${fmt(net)}</span></div>`;
    const b = f.querySelector("#sh-save"); b.textContent = sel.length ? "Mark " + plural(sel.length, "coin") + " paid" : "Mark paid"; b.disabled = !sel.length;
  };
  openSheet(html, {
    what: "payment",
    onInput: update,
    onChange: update,
    onSubmit(f){
      const sel = picked(f); if (!sel.length) return;
      const date = f.querySelector("#p-date").value || todayStr(), payTo = f.querySelector("#p-payto").value, now = nowIso();
      const writes = sel.map(([id, c]) => ["set", "coins", id, Object.assign({}, c, {paid: true, paidOn: date, payTo, updated: now})]);
      store.set("payTo", payTo);
      guarded(async () => { await runWrites(writes); closeSheet(); toast("Marked " + plural(sel.length, "coin") + " paid"); });
    }
  }, null);
  update();
}

/* grading submission */
function openSub(id, preset){
  const src = id ? state.subs.get(id) : null;
  if (id && !src) return;
  const lastCo = store.get("subCompany");
  const s = Object.assign(src ? {...src} : {company: COMPANIES.includes(lastCo) ? lastCo : "ICCS", service:"", ref:"", sentOn: todayStr(), returnedOn:"", total:0, status:"open", notes:"", iccsTier: "regular", extra: 0}, preset || {});
  const ret = s.status === "returned";
  const isIccs = s.company === "ICCS";
  if (isIccs && !iccsTier(s.iccsTier)){ const m = ICCS_TIERS.find(t => (s.service || "").toLowerCase().startsWith(t[1].toLowerCase())); s.iccsTier = m ? m[0] : "regular"; }
  const payFrom = s.payFrom || (src ? "other" : lastPay("payFrom"));
  const eligible = [...state.coins.entries()].filter(([cid, c]) => (id && c.subId === id) || c.status === "stock")
    .sort((a, b) => ((id && b[1].subId === id) - (id && a[1].subId === id)) || String(a[1].name).localeCompare(String(b[1].name)));
  const items = eligible.map(([cid, c]) => {
    const inSub = !!id && c.subId === id;
    return `<div class="chk" data-q="${esc([c.name, c.grade, c.cert, c.grader].join(" ").toLowerCase())}">
      <input type="checkbox" id="s-ck-${esc(cid)}" value="${esc(cid)}"${inSub ? " checked" : ""}>
      <label for="s-ck-${esc(cid)}"><span class="row-title">${esc(c.name)}${exTag(c)}</span><span class="row-sub">${esc(gradeLine(c))}${c.cert ? " · #" + esc(c.cert) : ""} · cost ${fmt(num((c.cost || 0) + (c.buyFees || 0)))}</span></label>
      <div class="field ctier iccs-only"><label for="s-t-${esc(cid)}">ICCS service</label><select id="s-t-${esc(cid)}" data-auto="${inSub && iccsTier(c.gradeTier) ? "0" : "1"}">${ICCS_TIERS.map(([k, l, pr]) => `<option value="${k}"${k === (inSub && iccsTier(c.gradeTier) ? c.gradeTier : iccsDefault(c, s.iccsTier)) ? " selected" : ""}>${l} \u00b7 $${pr}</option>`).join("")}</select></div>
      <div class="ret grid2"><div class="field"><label for="s-g-${esc(cid)}">Grade received</label><input id="s-g-${esc(cid)}" list="dl-grades" value="${esc(c.grade)}" autocomplete="off"></div><div class="field"><label for="s-c-${esc(cid)}">Cert #</label><input id="s-c-${esc(cid)}" value="${esc(c.cert)}" inputmode="numeric" autocomplete="off"></div></div>
    </div>`;
  }).join("");
  const html = `<form class="sheet-form sub-form${ret ? " returned" : ""}${isIccs ? " iccs" : ""}" id="sub-form" novalidate>
    <header class="sh-head gut"><h2 id="sh-title">${src ? "Grading submission" : "New grading submission"}</h2><button type="button" class="x" data-sh="close" aria-label="Close">✕</button></header>
    <div class="sh-body gut">
      <section class="sec">
        <div class="grid2">
          <div class="field"><label for="s-company">Grading company</label><select id="s-company">${opts(COMPANIES, s.company)}</select></div>
          <div class="field not-iccs"><label for="s-service">Service level</label><input id="s-service" list="dl-svc" value="${esc(isIccs ? "" : s.service)}" placeholder="Regular" autocomplete="off"></div>
          <div class="field iccs-only"><label for="s-tier">ICCS service</label><select id="s-tier">${ICCS_TIERS.filter(t => t[0] !== "reholder").map(([k, l, pr]) => `<option value="${k}"${s.iccsTier === k ? " selected" : ""}>${l} \u00b7 $${pr} a coin</option>`).join("")}</select></div>
          <div class="field"><label for="s-sent">Date sent</label><input id="s-sent" type="date" value="${esc(s.sentOn)}"></div>
          <div class="field"><label for="s-ref">Submission or order #</label><input id="s-ref" value="${esc(s.ref)}" autocomplete="off"></div>
        </div>
        <div class="grid2">
          <div class="field not-iccs"><label for="s-total">Total cost</label><input id="s-total" type="number" step="0.01" min="0" inputmode="decimal" value="${mv(isIccs ? 0 : s.total)}" placeholder="0.00"></div>
          <div class="field iccs-only"><label for="s-extra">Shipping and other costs</label><input id="s-extra" type="number" step="0.01" min="0" inputmode="decimal" value="${mv(s.extra)}" placeholder="0.00"></div>
          <div class="field ret-only"><label for="s-returned">Date returned</label><input id="s-returned" type="date" value="${esc(s.returnedOn)}"></div>
        </div>
        <div class="grid2"><div class="field"><label for="s-payfrom">Paid from</label>${paySel("s-payfrom", payFrom)}</div></div>
        <p class="hint not-iccs">Include grading fees, shipping both ways, insurance and any exchange or brokerage. Amounts in CAD.</p>
        <p class="hint iccs-only">ICCS prices are before tax, so 13% HST is added to each coin's fee. Variety attribution comes with grading. Each coin can have its own service below, and coins already graded by ICCS start on Variety and reholder ($6). Shipping and other costs are split evenly across the coins.</p>
        <div class="card stmt iccs-only" id="s-iccs-sum"></div>
        <div class="field"><span class="lab" id="ss-lab">Status</span><div class="status-pick duo" role="radiogroup" aria-labelledby="ss-lab">
          <label class="sp grade"><input type="radio" name="sstatus" id="s-st-open" value="open"${ret ? "" : " checked"}><span>Out at grader</span></label>
          <label class="sp stock"><input type="radio" name="sstatus" id="s-st-returned" value="returned"${ret ? " checked" : ""}><span>Returned</span></label>
        </div></div>
      </section>
      <section class="sec">
        <div class="block-head"><h3 class="eyebrow">Coins in this submission</h3><span class="split" id="s-split"></span></div>
        <p class="hint ret-only">Enter the grade and cert number each coin came back with. Returned coins go back to In stock.</p>
        ${eligible.length > 6 ? `<input type="search" id="s-q" placeholder="Filter coins" aria-label="Filter coins" autocomplete="off">` : ""}
        <div id="s-items">${items || `<p class="muted sm">No coins are in stock to send. Mark coins In stock first, then add them here.</p>`}</div>
      </section>
      <section class="sec"><h3 class="eyebrow">Notes</h3><div class="field"><textarea id="s-notes" aria-label="Notes" rows="2" placeholder="Tracking number, invoice, anything to remember">${esc(s.notes)}</textarea></div></section>
      ${dl("dl-svc", SERVICES.concat([...state.subs.values()].map(x => x.service)))}${dl("dl-grades", GRADES)}
    </div>
    <footer class="sh-foot gut" id="sh-foot">${footHTML(!!src)}</footer>
  </form>`;
  // ICCS: each coin pays its own service's fee plus 13% HST, plus an even share of shipping
  const iccsPlan = f => {
    const ids = [...f.querySelectorAll('.chk input[id^="s-ck-"]:checked')].map(x => x.value);
    const dflt = iccsTier(f.querySelector("#s-tier").value) || ICCS_TIERS[0];
    const extra = num(f.querySelector("#s-extra").value);
    const ec = Math.round(extra * 100), n = ids.length, base = n ? Math.floor(ec / n) : 0, rem = n ? ec - base * n : 0;
    const groups = {};
    const per = ids.map((cid, i) => {
      const sel = f.querySelector("#s-t-" + CSS.escape(cid));
      const t = iccsTier(sel && sel.value) || dflt;
      (groups[t[0]] = groups[t[0]] || {t, n: 0}).n++;
      return {cid, tier: t[0], cost: num(iccsCost(t[0]) + (base + (i < rem ? 1 : 0)) / 100)};
    });
    const pre = Object.values(groups).reduce((a, g) => a + g.t[2] * g.n, 0);
    const tax = num(per.reduce((a, x) => a + iccsCost(x.tier), 0) - pre);
    return {ids, dflt, extra, per, groups: ICCS_TIERS.map(t => groups[t[0]]).filter(Boolean), pre, tax, total: num(pre + tax + extra)};
  };
  const split = () => {
    const f = panel.querySelector("#sub-form"); if (!f) return;
    if (f.classList.contains("iccs")){
      const P = iccsPlan(f), n = P.ids.length;
      f.querySelector("#s-split").textContent = n ? `${plural(n, "coin")} · ${fmt(P.total / n)} average` : "None selected";
      f.querySelector("#s-iccs-sum").innerHTML = `
        ${P.groups.length ? P.groups.map(g => `<div class="sl"><span class="lbl">${g.t[1]}<small>${plural(g.n, "coin")} at ${fmt(g.t[2])}</small></span><span class="fig">${fmt(g.t[2] * g.n)}</span></div>`).join("") : `<div class="sl"><span class="lbl">No coins selected yet</span><span class="fig">${fmt(0)}</span></div>`}
        <div class="sl"><span class="lbl">HST<small>13%</small></span><span class="fig">${fmt(P.tax)}</span></div>
        ${P.extra ? `<div class="sl"><span class="lbl">Shipping and other costs</span><span class="fig">${fmt(P.extra)}</span></div>` : ""}
        <div class="sl total"><span class="lbl">Total cost</span><span class="fig">${fmt(P.total)}</span></div>`;
      return;
    }
    const n = f.querySelectorAll('.chk input[id^="s-ck-"]:checked').length, t = num(f.querySelector("#s-total").value);
    f.querySelector("#s-split").textContent = n ? `${plural(n, "coin")} · ${fmt(t / n)} each` : "None selected";
  };
  openSheet(html, {
    what: "submission",
    onInput(e){
      if (e.target.id === "s-q"){ const q = e.target.value.trim().toLowerCase(); panel.querySelectorAll(".chk").forEach(el => { el.hidden = !!q && !el.dataset.q.includes(q); }); }
      split();
    },
    onChange(e){
      if (e.target.id === "s-company") panel.querySelector("#sub-form").classList.toggle("iccs", e.target.value === "ICCS");
      if (e.target.id === "s-tier") panel.querySelectorAll('select[id^="s-t-"]').forEach(sel => { if (sel.dataset.auto === "1") sel.value = iccsDefault(state.coins.get(sel.id.slice(4)), e.target.value); });
      if (e.target.id && e.target.id.startsWith("s-t-")) e.target.dataset.auto = "0";
      if (e.target.name === "sstatus"){
        const r = e.target.value === "returned";
        panel.querySelector("#sub-form").classList.toggle("returned", r);
        const rd = panel.querySelector("#s-returned"); if (r && !rd.value) rd.value = todayStr();
      }
      split();
    },
    onSubmit(f){
      const g = i => f.querySelector("#" + i);
      const status = (f.querySelector("input[name=sstatus]:checked") || {}).value || "open";
      const iccs = g("s-company").value === "ICCS", P = iccs ? iccsPlan(f) : null;
      const total = iccs ? P.total : num(g("s-total").value);
      const ids = [...f.querySelectorAll('.chk input[id^="s-ck-"]:checked')].map(x => x.value);
      const now = nowIso();
      const subId = id || newId("subs");
      const doc = Object.assign({}, src || {}, {
        company: g("s-company").value, service: iccs ? (P.groups.length > 1 ? "Mixed services" : (P.groups[0] || {t: P.dflt}).t[1]) : g("s-service").value.trim(), iccsTier: iccs ? P.dflt[0] : "", extra: iccs ? P.extra : 0, ref: g("s-ref").value.trim(),
        sentOn: g("s-sent").value, returnedOn: status === "returned" ? (g("s-returned").value || todayStr()) : "",
        total, status, payFrom: g("s-payfrom").value, notes: g("s-notes").value.trim(), updated: now
      });
      if (!src) doc.created = now;
      store.set("subCompany", doc.company);
      const writes = [["set", "subs", subId, doc]];
      if (id) for (const [pid, c0] of coinsInSub(id)) if (!ids.includes(pid)){
        const c = {...c0, subId: "", gradeCost: 0, updated: now}; if (c.status === "grading") c.status = "stock"; writes.push(["set", "coins", pid, c]);
      }
      const cents = Math.round(total * 100), n = ids.length, base = n ? Math.floor(cents / n) : 0, rem = n ? cents - base * n : 0;
      ids.forEach((cid, i) => {
        const c0 = state.coins.get(cid); if (!c0) return;
        const c = {...c0, subId, gradeCost: (base + (i < rem ? 1 : 0)) / 100};
        delete c.gradeVariety;
        if (iccs){ const pp = P.per.find(x => x.cid === cid); c.gradeCost = pp ? pp.cost : 0; c.gradeTier = pp ? pp.tier : P.dflt[0]; }
        else if (c.gradeTier) c.gradeTier = "";
        if (c.status !== "sold") c.status = status === "returned" ? "stock" : "grading";
        if (status === "returned"){
          const gi = f.querySelector("#s-g-" + CSS.escape(cid)), ci = f.querySelector("#s-c-" + CSS.escape(cid));
          const ng = gi ? gi.value.trim() : "", nc = ci ? ci.value.trim() : "";
          let changed = false;
          if (ng && ng !== c.grade){ c.grade = ng; changed = true; }
          if (nc && nc !== c.cert){ c.cert = nc; changed = true; }
          if (changed && doc.company !== "Other") c.grader = doc.company;
        }
        if (JSON.stringify(c) !== JSON.stringify(c0)){ c.updated = now; writes.push(["set", "coins", cid, c]); }
      });
      guarded(async () => { await runWrites(writes); closeSheet(); toast(src ? (status === "returned" && src.status !== "returned" ? "Submission marked returned" : "Submission saved") : "Submission added"); });
    },
    onDelete(){
      const now = nowIso();
      const writes = coinsInSub(id).map(([cid, c0]) => { const c = {...c0, subId: "", gradeCost: 0, updated: now}; if (c.status === "grading") c.status = "stock"; return ["set", "coins", cid, c]; });
      writes.push(["del", "subs", id]);
      guarded(async () => { await runWrites(writes); closeSheet(); toast("Submission deleted. Its coins are back in stock."); });
    }
  }, null);
  split();
}

/* expense */
function openExp(id){
  const src = id ? state.expenses.get(id) : null;
  if (id && !src) return;
  const e = src ? {...src} : {date: todayStr(), category: "", description: "", amount: 0, notes: ""};
  const payFrom = e.payFrom || (src ? "other" : lastPay("payFrom"));
  const html = `<form class="sheet-form" id="exp-form" novalidate>
    <header class="sh-head gut"><h2 id="sh-title">${src ? "Expense" : "Log an expense"}</h2><button type="button" class="x" data-sh="close" aria-label="Close">✕</button></header>
    <div class="sh-body gut"><section class="sec">
      <div class="grid2">
        <div class="field"><label for="e-date">Date</label><input id="e-date" type="date" value="${esc(e.date)}"></div>
        <div class="field"><label for="e-amount">Amount (CAD)</label><input id="e-amount" type="number" step="0.01" min="0" inputmode="decimal" value="${mv(e.amount)}" placeholder="0.00"></div>
      </div>
      <div class="grid2"><div class="field"><label for="e-cat">Category</label><input id="e-cat" list="dl-cat" value="${esc(e.category)}" placeholder="Supplies & holders" autocomplete="off"></div><div class="field"><label for="e-payfrom">Paid from</label>${paySel("e-payfrom", payFrom)}</div></div>
      <div class="field"><label for="e-desc">What it was for</label><input id="e-desc" value="${esc(e.description)}" placeholder="e.g. 100 Saflip 2x2 flips" autocomplete="off"></div>
      <div class="field"><label for="e-notes">Notes</label><textarea id="e-notes" rows="2">${esc(e.notes)}</textarea></div>
      ${dl("dl-cat", EXP_CATS.concat([...state.expenses.values()].map(x => x.category)))}
    </section></div>
    <footer class="sh-foot gut" id="sh-foot">${footHTML(!!src)}</footer>
  </form>`;
  openSheet(html, {
    what: "expense",
    onSubmit(f){
      const g = i => f.querySelector("#" + i);
      const amount = num(g("e-amount").value);
      if (!amount){ g("e-amount").setAttribute("aria-invalid", "true"); g("e-amount").focus(); toast("Enter the amount."); return; }
      const doc = Object.assign({}, src || {}, {date: g("e-date").value || todayStr(), amount, payFrom: g("e-payfrom").value, category: g("e-cat").value.trim() || "Other", description: g("e-desc").value.trim(), notes: g("e-notes").value.trim(), updated: nowIso()});
      if (!src) doc.created = nowIso();
      guarded(async () => { await runWrites([["set", "expenses", id || newId("expenses"), doc]]); closeSheet(); toast(src ? "Expense saved" : "Expense logged"); });
    },
    onDelete(){ guarded(async () => { await runWrites([["del", "expenses", id]]); closeSheet(); toast("Expense deleted"); }); }
  }, src ? null : "#e-amount");
}

/* pick a coin to sell */
function openPicker(){
  const order = {stock:0, consigned:1, grading:2, incoming:3};
  const rank = c => isListed(c) ? -1 : order[c.status];
  const arr = [...state.coins.entries()].filter(([, c]) => c.status !== "sold").sort((a, b) => (rank(a[1]) - rank(b[1])) || String(a[1].name).localeCompare(String(b[1].name)));
  const html = `<div class="sheet-form">
    <header class="sh-head gut"><h2 id="sh-title">Which coin sold?</h2><button type="button" class="x" data-sh="close" aria-label="Close">✕</button></header>
    <div class="sh-body gut">
      ${arr.length ? `<input type="search" id="p-q" placeholder="Search coin, grade, cert #" aria-label="Search coins" autocomplete="off">
      <div class="list">${arr.map(([id, c]) => `<button type="button" class="row" data-sh="pick" data-id="${esc(id)}" data-q="${esc([c.name, c.grade, c.cert, c.grader].join(" ").toLowerCase())}"><span class="row-main"><span class="row-title">${esc(c.name)}${exTag(c)}</span><span class="row-sub">${esc(gradeLine(c))}${c.cert ? " · #" + esc(c.cert) : ""}</span></span><span class="row-side">${pill(c.status)}<span class="fig">${fmt(basis(c))}</span></span></button>`).join("")}</div>`
      : `<div class="empty"><p>There are no unsold coins in your inventory.</p></div>`}
    </div>
  </div>`;
  openSheet(html, {
    onInput(e){ if (e.target.id === "p-q"){ const q = e.target.value.trim().toLowerCase(); panel.querySelectorAll("[data-sh=pick]").forEach(el => { el.hidden = !!q && !el.dataset.q.includes(q); }); } },
    onPick(id){ closeSheet(); openCoin(id, {status: "sold", soldOn: todayStr()}); }
  }, arr.length > 8 ? "#p-q" : null);
}

/* account balances */
function openAcct(){
  const b = balances();
  const sec = k => {
    const a = state.accounts.get(k) || {}, x = b[k];
    return `<section class="sec">
      <h3 class="eyebrow">${ACCT_NAME[k]}</h3>
      <div class="grid2">
        <div class="field"><label for="a-open-${k}">Starting balance</label><input id="a-open-${k}" type="number" step="0.01" inputmode="decimal" value="${state.accounts.has(k) ? esc(String(a.opening || 0)) : ""}" placeholder="0.00"></div>
        <div class="field"><label for="a-since-${k}">At the start of</label><input id="a-since-${k}" type="date" value="${esc(a.since || todayStr())}"></div>
        <div class="field"><label for="a-actual-${k}">${k === "eq" ? "Balance in your EQ Bank app" : "Cash you count now"}</label><input id="a-actual-${k}" type="number" step="0.01" inputmode="decimal" placeholder="Optional"></div>
        <p class="hint" style="align-self:end">The ledger shows <span class="fig">${fmtS(x.bal)}</span>. Enter the real figure to record the difference as a balance adjustment, such as interest.</p>
      </div>
    </section>`;
  };
  const html = `<form class="sheet-form" id="acct-form" novalidate>
    <header class="sh-head gut"><h2 id="sh-title">Cash and EQ Bank</h2><button type="button" class="x" data-sh="close" aria-label="Close">✕</button></header>
    <div class="sh-body gut">
      <p class="muted">Each balance starts from the figure you enter here. Anything dated on or after its start date, paid from or into that account, is added to it.</p>
      ${sec("cash")}${sec("eq")}
    </div>
    <footer class="sh-foot gut" id="sh-foot">${footHTML(false)}</footer>
  </form>`;
  openSheet(html, {
    what: "balances",
    onSubmit(f){
      const g = i => f.querySelector("#" + i);
      const now = nowIso(), writes = [], L = ledger();
      for (const [k] of ACCTS){
        const ov = g("a-open-" + k).value.trim(), since = g("a-since-" + k).value || todayStr(), act = g("a-actual-" + k).value.trim();
        const had = state.accounts.get(k);
        let opening = had ? num(had.opening) : 0, sinceEff = had ? (had.since || "") : "";
        if (ov !== "" || had){
          opening = num(ov); sinceEff = since;
          const doc = Object.assign({}, had || {}, {name: ACCT_NAME[k], opening, since, updated: now});
          delete doc.example;
          if (!had) doc.created = now;
          if (!had || had.opening !== opening || had.since !== since || had.example) writes.push(["set", "accounts", k, doc]);
        }
        if (act !== ""){
          const bal = num(opening + sum(L.filter(e => e.acct === k && !(sinceEff && e.date && e.date < sinceEff)), e => e.amt));
          const diff = num(num(act) - bal);
          if (Math.abs(diff) >= 0.01){
            const mv = {date: todayStr(), kind: diff > 0 ? "in" : "out", amount: Math.abs(diff), note: "Balance adjustment", from: "", to: "", created: now, updated: now};
            if (diff > 0) mv.to = k; else mv.from = k;
            writes.push(["set", "moves", newId("moves"), mv]);
          }
        }
      }
      if (!writes.length){ closeSheet(); return; }
      guarded(async () => { await runWrites(writes); closeSheet(); toast("Balances updated"); });
    }
  }, null);
}

/* transfers, money in, money out */
function openMove(id, preset){
  const src = id ? state.moves.get(id) : null;
  if (id && !src) return;
  const m = Object.assign(src ? {...src} : {kind: "transfer", date: todayStr(), from: "", to: "", amount: 0, note: ""}, preset || {});
  if (!isAcct(m.from)) m.from = m.kind === "transfer" ? "cash" : "eq";
  if (!isAcct(m.to)) m.to = m.kind === "transfer" ? (m.from === "cash" ? "eq" : "cash") : "eq";
  const acctSel = (fid, cur) => `<select id="${fid}">${ACCTS.map(([k, l]) => `<option value="${k}"${k === cur ? " selected" : ""}>${l}</option>`).join("")}</select>`;
  const html = `<form class="sheet-form move-form" id="move-form" data-kind="${esc(m.kind)}" novalidate>
    <header class="sh-head gut"><h2 id="sh-title">${src ? "Money movement" : "Record money"}</h2><button type="button" class="x" data-sh="close" aria-label="Close">✕</button></header>
    <div class="sh-body gut"><section class="sec">
      <div class="field"><span class="lab" id="mk-lab">Type</span><div class="status-pick tri" role="radiogroup" aria-labelledby="mk-lab">
        ${[["transfer","Transfer"],["in","Money in"],["out","Money out"]].map(([k, l]) => `<label class="sp stock"><input type="radio" name="mkind" id="m-k-${k}" value="${k}"${m.kind === k ? " checked" : ""}><span>${l}</span></label>`).join("")}
      </div></div>
      <div class="grid2">
        <div class="field"><label for="m-date">Date</label><input id="m-date" type="date" value="${esc(m.date)}"></div>
        <div class="field"><label for="m-amount">Amount (CAD)</label><input id="m-amount" type="number" step="0.01" min="0" inputmode="decimal" value="${mv(m.amount)}" placeholder="0.00"></div>
        <div class="field m-from"><label for="m-from">From</label>${acctSel("m-from", m.from)}</div>
        <div class="field m-to"><label for="m-to">Into</label>${acctSel("m-to", m.to)}</div>
      </div>
      <div class="field"><label for="m-note">Note</label><input id="m-note" list="dl-mnote" value="${esc(m.note)}" placeholder="Owner deposit, interest, cash deposit" autocomplete="off"></div>
      <p class="hint">Use Money in for owner deposits and interest, and Money out for owner draws and bank fees. Coin purchases, sales, grading and expenses already move the balances on their own.</p>
      ${dl("dl-mnote", MOVE_NOTES.concat([...state.moves.values()].map(x => x.note)))}
    </section></div>
    <footer class="sh-foot gut" id="sh-foot">${footHTML(!!src)}</footer>
  </form>`;
  openSheet(html, {
    what: "entry",
    onChange(e){ if (e.target.name === "mkind") panel.querySelector("#move-form").dataset.kind = e.target.value; },
    onSubmit(f){
      const g = i => f.querySelector("#" + i);
      const kind = (f.querySelector("input[name=mkind]:checked") || {}).value || "transfer";
      const amount = num(g("m-amount").value);
      if (!(amount > 0)){ g("m-amount").setAttribute("aria-invalid", "true"); g("m-amount").focus(); toast("Enter the amount."); return; }
      const from = g("m-from").value, to = g("m-to").value;
      if (kind === "transfer" && from === to){ toast("Pick two different accounts for a transfer."); return; }
      const doc = Object.assign({}, src || {}, {kind, date: g("m-date").value || todayStr(), amount, from: kind === "in" ? "" : from, to: kind === "out" ? "" : to, note: g("m-note").value.trim(), updated: nowIso()});
      if (!src) doc.created = nowIso();
      guarded(async () => { await runWrites([["set", "moves", id || newId("moves"), doc]]); closeSheet(); toast(src ? "Saved" : (kind === "transfer" ? "Transfer recorded" : "Recorded")); });
    },
    onDelete(){ guarded(async () => { await runWrites([["del", "moves", id]]); closeSheet(); toast("Deleted"); }); }
  }, src ? null : "#m-amount");
}

/* scan receipts, invoices and slab labels */
const PDFJS = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/";
const ICON_CAM = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 8h3l1.5-2h7L17 8h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg>';
const ICON_DOC = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 3h7l4 4v14H7z"/><path d="M14 3v4h4M10 12h5M10 16h5"/></svg>';
const DOC_LABEL = {invoice: "Invoice", receipt: "Order receipt", cert: "Slab or cert photo", other: "Document"};
const scan = {files: [], urls: [], step: "pick", ctl: null, result: null, error: "", timer: null, started: 0};
const isPdf = f => f.type === "application/pdf" || /\.pdf$/i.test(f.name || "");
const isImg = f => /^image\//.test(f.type || "") || /\.(jpe?g|png|webp|gif|heic|heif)$/i.test(f.name || "");
let pdfReady = null;
function loadScript(src){ return new Promise((res, rej) => { const el = document.createElement("script"); el.src = src; el.onload = () => res(); el.onerror = () => rej(new Error("load")); document.head.appendChild(el); }); }
function loadPdfLib(){
  if (!pdfReady){
    pdfReady = loadScript(PDFJS + "pdf.min.js").then(() => loadScript(PDFJS + "pdf.worker.min.js")).then(() => { if (!window.pdfjsLib) throw new Error("pdfjs"); return window.pdfjsLib; });
    pdfReady.catch(() => { pdfReady = null; });
  }
  return pdfReady;
}
const canvasBlob = cv => new Promise((res, rej) => cv.toBlob(bl => bl ? res(bl) : rej(new Error("toBlob")), "image/jpeg", 0.88));
function decodeImg(file){ return new Promise((res, rej) => { const u = URL.createObjectURL(file); const im = new Image(); im.onload = () => { URL.revokeObjectURL(u); res(im); }; im.onerror = () => { URL.revokeObjectURL(u); rej(new Error("decode")); }; im.src = u; }); }
async function prepImage(file){
  const L = state.imgLimits || {}, max = Platform.resizeTo || 0;
  const fits = (L.mediaTypes || []).includes(file.type) && file.size <= (L.maxInputBytes || 5e6);
  if (fits && !max) return file;
  const im = await decodeImg(file);
  const w = im.naturalWidth, h = im.naturalHeight, k = Math.min(1, (max || 2400) / Math.max(w, h));
  if (fits && k === 1) return file;
  const cv = document.createElement("canvas"); cv.width = Math.max(1, Math.round(w * k)); cv.height = Math.max(1, Math.round(h * k));
  cv.getContext("2d").drawImage(im, 0, 0, cv.width, cv.height);
  return canvasBlob(cv);
}
async function pdfPages(file, maxPages){
  const lib = await loadPdfLib();
  const doc = await lib.getDocument({data: new Uint8Array(await file.arrayBuffer()), isEvalSupported: false}).promise;
  const blobs = []; let text = "";
  for (let i = 1; i <= Math.min(doc.numPages, 8); i++){
    const page = await doc.getPage(i);
    if (i <= maxPages){
      const v1 = page.getViewport({scale: 1}), vp = page.getViewport({scale: Math.min(2.5, 1600 / v1.width)});
      const cv = document.createElement("canvas"); cv.width = Math.ceil(vp.width); cv.height = Math.ceil(vp.height);
      const ctx = cv.getContext("2d"); ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, cv.width, cv.height);
      await page.render({canvasContext: ctx, viewport: vp}).promise;
      blobs.push(await canvasBlob(cv));
    }
    try { const tc = await page.getTextContent(); text += tc.items.map(it => it.str).join(" ") + "\n"; } catch(e){}
  }
  return {blobs, text: text.replace(/[ \t]+/g, " ").slice(0, 20000)};
}
function scanPrompt(pdfText, nImages){
  return `You're reading purchase documents for a Canadian coin dealer's inventory. Today is ${todayStr()}.
The ${nImages} attached file(s)${pdfText ? " and the PDF text below" : ""} show one of these: an invoice or online order receipt for coins bought (auction house, dealer, eBay, or a screenshot of an order), or photos of grading slab labels or certificates (PCGS, NGC, CGC, ICCS, CCCS). Several images may be pages or sides of the same thing.

List every lot or line, and every coin in it. Reply with only a JSON object in this shape:
{"docType":"invoice"|"receipt"|"cert"|"other","seller":string|null,"orderDate":"YYYY-MM-DD"|null,"orderRef":string|null,"currency":"CAD"|"USD"|string|null,
"lots":[{"lotRef":string|null,"description":string|null,"price":number|null,"coins":[{"name":string,"count":number,"grader":"PCGS"|"NGC"|"CGC"|"ICCS"|"CCCS"|"Raw"|"Other","grade":string|null,"cert":string|null,"variety":string|null,"comments":string|null,"notes":string|null}]}],
"shipping":number|null,"buyersPremium":number|null,"tax":number|null,"otherFees":number|null,"total":number|null}

Field rules:
- lots: one entry per invoice line or auction lot. A slab or cert photo is one lot per coin, with price null.
- lotRef: the lot or item number, if shown. description: the line's own wording, shortened.
- price: the line's price before buyer's premium, shipping and tax: the hammer price for an auction lot, or the line total for a store or eBay line (unit price times quantity). A plain number in the document's currency. null when no price is shown.
- coins: every coin in that lot. When a lot holds several different coins, list each one. When it holds several of the same coin, list it once with count set to how many. Otherwise count is 1.
- name: year, mint mark, denomination and variety, short, the way a Canadian collector writes it: "1955 Arnprior $1", "1947 Maple Leaf 1¢", "1936 Dot 10¢", "1858 1¢ Province of Canada". Use ¢ for cents and $ for dollars. Add the country only when it isn't Canada. For a lot that isn't itemized (a mixed bag, an unsearched roll), use the line's description as the name with count 1.
- grade: as printed, with designations: "MS-64 RD", "AU-55", "PL-65 Heavy Cameo", "VF-30". null when no grade is given.
- grader: the company that graded the slab; "Raw" when the coin isn't slabbed or no grader is named.
- cert: the certification number as printed on the label. null if you can't read every digit.
- variety: the coin's variety or attribution, such as "Double Waterline" or "Near Leaf", from the label or the listing. null if none.
- comments: for a slab or cert, everything printed in its comments or designation area that isn't the grade or variety, as printed (ICCS's Comments line such as "Cleaned" or "Full Red"; PCGS or NGC designations and pedigree lines). Join several with " \u00b7 ". null if none.
- notes: anything else worth keeping for that coin, such as a lot description or seller's remarks. Otherwise null.
- orderDate: the order, invoice or payment date. null for slab or cert photos.
- seller: the auction house, dealer, store or eBay seller. null if not shown. orderRef: the invoice or order number. null if none.
- shipping: shipping, handling, postage and insurance for the whole order. buyersPremium: the total buyer's premium if it's charged separately from the lot prices. tax: total sales tax (HST, GST, PST or state tax), including tax on the premium and shipping. otherFees: anything else charged on top, such as payment, platform, import, duty or brokerage fees; a discount is a negative number here. total: the grand total charged. Use null for any that aren't shown.
Never guess digits you can't read; use null. If nothing coin-related is shown, use docType "other" and an empty lots array.${pdfText ? "\n\nPDF text:\n" + pdfText : ""}`;
}
function splitLot(lot){
  if (lot.items.length === 1){ const it = lot.items[0]; it.pinned = false; it.price = lot.price; return; }
  if (lot.price == null) return;
  const free = lot.items.filter(it => !it.pinned);
  if (!free.length) return;
  const pinnedSum = lot.items.filter(it => it.pinned).reduce((a, it) => a + (it.price || 0), 0);
  const rest = Math.max(0, Math.round((lot.price - pinnedSum) * 100));
  const base = Math.floor(rest / free.length), rem = rest - base * free.length;
  free.forEach((it, i) => { it.price = (base + (i < rem ? 1 : 0)) / 100; });
}
const exTotal = r => num((r.ex.ship || 0) + (r.ex.bp || 0) + (r.ex.tax || 0) + (r.ex.other || 0));
const lotAmount = l => l.price != null ? l.price : num(l.items.reduce((a, it) => a + (it.price || 0), 0));
function allocFees(r){
  const inc = [];
  r.lots.forEach(l => l.items.forEach(it => { it.fee = 0; if (it.inc) inc.push(it); }));
  const E = Math.round(exTotal(r) * 100);
  if (!inc.length || !E) return;
  const W = inc.reduce((a, it) => a + Math.max(0, it.price || 0), 0);
  const raw = inc.map(it => W > 0 ? E * Math.max(0, it.price || 0) / W : E / inc.length);
  const fl = raw.map(v => Math.floor(v));
  const left = E - fl.reduce((a, b) => a + b, 0);
  const order = raw.map((v, i) => [v - fl[i], i]).sort((a, b) => b[0] - a[0]);
  for (let k = 0; k < left; k++) fl[order[k % order.length][1]]++;
  inc.forEach((it, i) => { it.fee = fl[i] / 100; });
}
function normScan(raw){
  const r = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  const S = v => v == null ? "" : String(v).trim();
  const N = v => { if (v == null || v === "") return null; const n = parseFloat(String(v).replace(/[^0-9.\-]/g, "")); return Number.isFinite(n) ? Math.round(n * 100) / 100 : null; };
  const certs = new Set([...state.coins.values()].map(c => S(c.cert)).filter(Boolean));
  const mkItem = (c, nameOverride) => {
    const gr = S(c.grader), grader = GRADERS.find(x => x.toLowerCase() === gr.toLowerCase()) || (gr ? "Other" : "Raw");
    const cert = S(c.cert).replace(/\s+/g, " "), dup = !!cert && certs.has(cert);
    return {name: nameOverride || S(c.name), grader, grade: S(c.grade), cert, variety: S(c.variety), comments: S(c.comments), notes: S(c.notes), dup, inc: !dup, price: null, pinned: false, fee: 0};
  };
  const rawLots = Array.isArray(r.lots) ? r.lots : (Array.isArray(r.coins) ? r.coins.map(c => ({price: c.price, coins: [Object.assign({}, c, {count: c.qty})]})) : []);
  const lots = [];
  for (const L of rawLots){
    if (!L || typeof L !== "object") continue;
    const items = [];
    for (const c of Array.isArray(L.coins) ? L.coins : []){
      if (!c || typeof c !== "object" || !S(c.name)) continue;
      const count = Math.max(1, Math.round(Number(c.count) || 1));
      if (count <= 25) for (let i = 0; i < count; i++) items.push(mkItem(c));
      else items.push(mkItem(c, "Lot of " + count + ": " + S(c.name)));
    }
    if (!items.length && S(L.description)) items.push(mkItem({name: S(L.description)}));
    if (!items.length) continue;
    const lot = {ref: S(L.lotRef), desc: S(L.description), price: N(L.price), items};
    splitLot(lot);
    lots.push(lot);
  }
  let cur = S(r.currency).toUpperCase();
  if (!cur || /^C\$|CAD|CDN/.test(cur)) cur = "CAD"; else if (/^US|USD|^\$$/.test(cur)) cur = cur === "$" ? "CAD" : "USD";
  const docType = ["invoice", "receipt", "cert", "other"].includes(r.docType) ? r.docType : (lots.length ? "receipt" : "other");
  const ex = {ship: N(r.shipping), bp: N(r.buyersPremium), tax: N(r.tax), other: N(r.otherFees)};
  if (r.orderExtras != null && ex.ship == null && ex.bp == null && ex.tax == null && ex.other == null) ex.other = N(r.orderExtras);
  const total = N(r.total);
  const itemsSum = num(lots.reduce((a, l) => a + lotAmount(l), 0));
  const res = {docType, seller: S(r.seller), orderDate: /^\d{4}-\d{2}-\d{2}$/.test(S(r.orderDate)) ? S(r.orderDate) : "", orderRef: S(r.orderRef), currency: cur, ex, total, lots};
  if (total != null && itemsSum > 0 && !exTotal(res)){ const gap = num(total - itemsSum); if (Math.abs(gap) >= 0.01) ex.other = gap; }
  return res;
}
function scanErr(e){
  switch (e && e.code){
    case "no_key": return "Add your Anthropic API key in Settings (the gear at the top) so Claude can read this. Slab labels are read on the phone without one.";
    case "bad_key": return "Your Anthropic API key was turned down. Check it in Settings.";
    case "no_credit": return "Your Anthropic account is out of credit. Add credit at console.anthropic.com, then try again.";
    case "offline": return "There's no internet connection, so Claude can't read this right now. Slab labels can still be read on the phone.";
    case "overloaded": return "Claude is busy right now. Try again in a minute.";
    case "too_large": return "That file is too big to send. Try a smaller photo or fewer pages.";
    case "not_granted": return "Reading documents needs your OK to use Claude. You can still add coins by hand.";
    case "sampling_disabled": case "not_declared": case "capability_disabled": case "capability_removed": case "images_unavailable": return "Reading photos isn't available here. You can still add coins by hand.";
    case "image_rejected": return "One of the images couldn't be read. Try a smaller or clearer photo, or a screenshot.";
    case "rate_limited": return "You've reached your Claude usage limit for now. Try again later, or add the coin by hand.";
    case "session_expired": return "Sign in to Claude again, then try once more.";
    case "refused": return "Claude couldn't read that document. Try a different photo.";
    case "prompt_too_large": return "That PDF has too much text. Upload just the pages with the coins.";
    default: return "Reading didn't finish. Try again.";
  }
}
function scanReset(){
  if (scan.ctl) scan.ctl.abort();
  scan.ctl = null; clearInterval(scan.timer);
  scan.urls.forEach(u => { if (u) URL.revokeObjectURL(u); });
  scan.files = []; scan.urls = []; scan.step = "pick"; scan.result = null; scan.error = "";
}
function openScan(){
  scanReset();
  openSheet(`<form class="sheet-form" id="scan-form" novalidate>
    <header class="sh-head gut"><h2 id="sh-title">Add from a receipt or cert</h2><button type="button" class="x" data-sh="close" aria-label="Close">✕</button></header>
    <div class="sh-body gut" id="scan-body"></div>
    <footer class="sh-foot gut" id="sh-foot"></footer>
  </form>`, {what: "scan", onChange: scanChange, onInput: scanInput, onSubmit: scanSubmit, onAction: scanAction, onClose: scanReset}, null);
  renderScanPick();
}
function renderScanPick(){
  scan.step = "pick";
  const body = panel.querySelector("#scan-body"), foot = panel.querySelector("#sh-foot");
  if (!body || !foot) return;
  const n = scan.files.length, max = (state.imgLimits && state.imgLimits.maxCount) || 5;
  body.innerHTML = `
    ${scan.error ? `<div class="note warn" role="alert"><p>${esc(scan.error)}</p></div>` : ""}
    <p class="muted">Photograph a slab label or certificate, or upload an invoice, order receipt or screenshot. Claude reads the coins, grades, cert numbers, seller and date, and you check everything before it's added.</p>
    <div class="pickrow">
      <div class="pick">${ICON_CAM}<span><b>Take a photo</b><small>Slab label or cert</small></span><input class="pick-in" id="sc-cam" type="file" accept="image/*" capture="environment" aria-label="Take a photo of a slab label or cert"></div>
      <div class="pick">${ICON_DOC}<span><b>Choose photos or files</b><small>Invoice, receipt, PDF or screenshot</small></span><input class="pick-in" id="sc-file" type="file" accept="image/*,application/pdf,.pdf" multiple aria-label="Choose photos, a PDF or screenshots"></div>
    </div>
    <p class="hint">You can also paste a screenshot here, or drop files onto this panel on a computer. If tapping doesn't open your camera or photos, open this ledger in Chrome or Safari instead of the Claude app.</p>
    ${n ? `<div class="thumbs">${scan.files.map((f, i) => `<div class="thumb">${isPdf(f) ? `<span class="pdf">PDF</span>` : `<img src="${scan.urls[i]}" alt="">`}<span class="tname">${esc(f.name || "Photo")}</span><button type="button" class="x sm" data-sh="sc-rm" data-i="${i}" aria-label="Remove ${esc(f.name || "photo")}">✕</button></div>`).join("")}</div>
      <p class="hint">Add more photos of the same order or slab if you need to, then read them together. Up to ${max} images are read at once, and the first 3 pages of a PDF.</p>` : ""}`;
  foot.innerHTML = `<span class="grow"></span><button type="button" class="btn ghost" data-sh="close">Cancel</button><button type="submit" class="btn primary" id="sc-go"${n ? "" : " disabled"}>${n > 1 ? "Read " + n + " files" : "Read it"}</button>`;
}
function scanChange(e){
  const t = e.target;
  if (t.id === "sc-cam" || t.id === "sc-file"){
    const all = [...(t.files || [])];
    t.value = "";
    addScanFiles(all);
  } else if (scan.step === "review") scanInput(e);
}
function addScanFiles(all){
  if (!all || !all.length) return;
  const add = all.filter(f => isPdf(f) || isImg(f) || !f.type);
  for (const f of add){ scan.files.push(f); scan.urls.push(isPdf(f) ? "" : URL.createObjectURL(f)); }
  scan.error = all.length > add.length ? "Some files were skipped. Use photos, screenshots or PDFs." : "";
  renderScanPick();
}
const scanPicking = () => !!state.sheet && state.sheet.what === "scan" && scan.step === "pick";
document.addEventListener("paste", e => {
  if (!scanPicking()) return;
  const files = [...((e.clipboardData && e.clipboardData.files) || [])];
  if (!files.length) return;
  e.preventDefault(); addScanFiles(files);
});
function scanInput(e){
  if (scan.step !== "review" || !scan.result || !e || !e.target) return;
  const t = e.target, id = t.id || "", r = scan.result; let m;
  const val = () => t.value === "" ? null : num(t.value);
  if ((m = id.match(/^sc-lp-(\d+)$/))){ const l = r.lots[+m[1]]; if (!l) return; l.price = val(); splitLot(l); }
  else if ((m = id.match(/^sc-ip-(\d+)-(\d+)$/))){
    const l = r.lots[+m[1]], it = l && l.items[+m[2]]; if (!it) return;
    if (l.items.length === 1){ l.price = val(); it.price = l.price; }
    else { it.price = val(); it.pinned = it.price != null; splitLot(l); }
  }
  else if ((m = id.match(/^sc-x-(ship|bp|tax|other)$/))) r.ex[m[1]] = val();
  else if ((m = id.match(/^sc-inc-(\d+)-(\d+)$/))){ const it = r.lots[+m[1]] && r.lots[+m[1]].items[+m[2]]; if (it) it.inc = t.checked; }
  else return;
  scanRecalc(id);
}
function scanAction(a, b){
  if (a === "sc-rm"){ const i = Number(b.dataset.i); if (scan.urls[i]) URL.revokeObjectURL(scan.urls[i]); scan.files.splice(i, 1); scan.urls.splice(i, 1); renderScanPick(); }
  else if (a === "sc-stop"){ if (scan.ctl) scan.ctl.abort(); }
  else if (a === "sc-restart"){ scan.result = null; scan.error = ""; renderScanPick(); }
  else if (a === "sc-convert") scanConvert();
  else if (a === "sc-resplit"){ const l = scan.result && scan.result.lots[+b.dataset.l]; if (l){ l.items.forEach(it => { it.pinned = false; }); splitLot(l); scanRecalc(""); } }
  else if (a === "sc-showfees"){ const sec = panel.querySelector("#sc-fees"); if (sec) sec.hidden = false; b.remove(); }
}
async function runScan(){
  if (!scan.files.length || scan.step === "reading" || !state.sample) return;
  const ctl = new AbortController(); scan.ctl = ctl; scan.step = "reading"; scan.error = "";
  const live = () => scan.ctl === ctl && !!state.sheet;
  const body = panel.querySelector("#scan-body"), foot = panel.querySelector("#sh-foot");
  body.innerHTML = `<div class="reading"><span class="spin" aria-hidden="true"></span><p><b>Reading ${scan.files.length > 1 ? scan.files.length + " files" : "your file"}</b></p><p class="hint" id="sc-elapsed">This usually takes 10 to 40 seconds.</p></div>`;
  foot.innerHTML = `<span class="grow"></span><button type="button" class="btn" data-sh="sc-stop">Stop</button>`;
  scan.started = Date.now(); clearInterval(scan.timer);
  scan.timer = setInterval(() => { const el = panel.querySelector("#sc-elapsed"); if (el) el.textContent = Math.round((Date.now() - scan.started) / 1000) + " seconds so far. This usually takes 10 to 40 seconds."; }, 1000);
  const finish = () => { clearInterval(scan.timer); };
  // On the phone, slab and cert photos are read there first: free and offline.
  if (Platform.readLabel && scan.files.every(f => !isPdf(f))){
    const local = [];
    for (const f of scan.files){
      if (ctl.signal.aborted) break;
      let r = null; try { r = await Platform.readLabel(f); } catch(e){ r = null; }
      local.push(r);
    }
    if (ctl.signal.aborted){ finish(); if (live()){ scan.ctl = null; renderScanPick(); } return; }
    const good = local.filter(r => r && r.found >= 3), canAsk = !Platform.canAsk || Platform.canAsk();
    if (good.length === local.length || (!canAsk && local.some(Boolean))){
      finish(); if (!live()) return;
      scan.ctl = null;
      const res = normScan({docType: "cert", lots: local.filter(Boolean).map(r => ({price: null, coins: [Object.assign({count: 1}, r.label)]}))});
      if (good.length < local.length) res.note = "Some labels couldn't be read fully on the phone. Check them, or add your Anthropic API key in Settings so Claude can read the rest.";
      if (res.lots.length){ scan.result = res; renderScanReview(); return; }
    }
  }
  let blobs = []; const texts = [], pdfs = [];
  try {
    for (const f of scan.files){
      if (ctl.signal.aborted) break;
      if (isPdf(f) && Platform.pdfDirect) pdfs.push(f);
      else if (isPdf(f)){ const r = await pdfPages(f, 3); blobs.push(...r.blobs); if (r.text.trim()) texts.push("[" + (f.name || "PDF") + "]\n" + r.text); }
      else blobs.push(await prepImage(f));
    }
  } catch(e){
    finish(); if (!live()) return;
    scan.ctl = null; scan.error = "One of the files couldn't be opened. Try a photo or screenshot of it instead."; renderScanPick(); return;
  }
  if (ctl.signal.aborted){ finish(); if (live()){ scan.ctl = null; renderScanPick(); } return; }
  const max = (state.imgLimits && state.imgLimits.maxCount) || 5;
  const dropped = Math.max(0, blobs.length - max); blobs = blobs.slice(0, max);
  try {
    const opts = {images: blobs, signal: ctl.signal}; if (pdfs.length) opts.pdfs = pdfs;
    const raw = await state.sample.json(scanPrompt(texts.join("\n\n").slice(0, 30000), blobs.length + pdfs.length), opts);
    finish(); if (!live()) return;
    scan.ctl = null;
    const res = normScan(raw);
    if (!res.lots.length){ scan.error = "No coins were found in " + (scan.files.length > 1 ? "those files" : "that file") + ". Try a sharper photo, or add the coin by hand."; renderScanPick(); return; }
    res.dropped = dropped; scan.result = res; renderScanReview();
  } catch(e){
    finish(); if (!live()) return;
    scan.ctl = null;
    if (e && e.code === "cancelled"){ renderScanPick(); return; }
    scan.error = scanErr(e); renderScanPick();
    if (e && ["not_granted", "sampling_disabled", "not_declared", "capability_disabled", "capability_removed", "images_unavailable"].includes(e.code)){ state.sample = null; render(); }
  }
}
function scanItemHTML(it, L, I, multi){
  const k = L + "-" + I;
  return `<div class="scoin">
    <div class="scoin-top"><label class="inc"><input type="checkbox" id="sc-inc-${k}"${it.inc ? " checked" : ""}><span>Add this coin</span></label>${it.dup ? `<span class="pill in">Cert already in inventory</span>` : ""}</div>
    <div class="field"><label for="sc-name-${k}">Coin</label><input id="sc-name-${k}" value="${esc(it.name)}" autocomplete="off"></div>
    <div class="grid2">
      <div class="field"><label for="sc-grader-${k}">Grader</label><select id="sc-grader-${k}">${opts(GRADERS, it.grader)}</select></div>
      <div class="field"><label for="sc-grade-${k}">Grade</label><input id="sc-grade-${k}" list="dl-grades" value="${esc(it.grade)}" autocomplete="off"></div>
    </div>
    <div class="grid2">
      <div class="field"><label for="sc-cert-${k}">Cert #</label><input id="sc-cert-${k}" value="${esc(it.cert)}" inputmode="numeric" autocomplete="off"></div>
      <div class="field"><label for="sc-var-${k}">Variety</label><input id="sc-var-${k}" value="${esc(it.variety || "")}" autocomplete="off"></div>
    </div>
    <div class="field"><label for="sc-com-${k}">Comments on the cert</label><input id="sc-com-${k}" value="${esc(it.comments || "")}" autocomplete="off"></div>
    <div class="grid2">
      <div class="field"><label for="sc-ip-${k}">${multi ? "Share of lot" : "Price"}</label><input id="sc-ip-${k}" type="number" step="0.01" min="0" inputmode="decimal" value="${it.price == null ? "" : it.price.toFixed(2)}" placeholder="${multi ? "0.00" : "Not shown"}"${it.price == null && !multi ? ' class="missing"' : ""}></div>
    </div>
    <p class="costline" id="sc-cl-${k}"></p>
    ${it.notes ? `<p class="hint">${esc(it.notes)}</p>` : ""}
  </div>`;
}
function scanLotHTML(l, L){
  const multi = l.items.length > 1;
  const title = l.ref ? "Lot " + l.ref.replace(/^lot\s*#?\s*/i, "") : (multi ? "Lot" : "");
  const head = (multi || l.ref) ? `<div class="lot-head">
      <div class="lot-title">${title ? `<b>${esc(title)}</b>` : ""}<span class="muted sm">${esc([multi ? plural(l.items.length, "coin") : "", l.desc].filter(Boolean).join(" · "))}</span></div>
      ${multi ? `<div class="field lot-price"><label for="sc-lp-${L}">Lot price</label><input id="sc-lp-${L}" type="number" step="0.01" min="0" inputmode="decimal" value="${l.price == null ? "" : l.price.toFixed(2)}" placeholder="0.00"></div>` : ""}
    </div>` : "";
  return `<div class="lot${multi ? " multi" : ""}">
    ${head}
    ${multi ? `<div class="lot-tools"><span class="hint" id="sc-lw-${L}"></span><button type="button" class="linkbtn sm" data-sh="sc-resplit" data-l="${L}">Split evenly</button></div>` : ""}
    ${l.items.map((it, I) => scanItemHTML(it, L, I, multi)).join("")}
  </div>`;
}
function renderScanReview(){
  scan.step = "review";
  const r = scan.result, body = panel.querySelector("#scan-body"), foot = panel.querySelector("#sh-foot");
  if (!body || !foot) return;
  const status = r.docType === "cert" ? "stock" : "incoming";
  const max = (state.imgLimits && state.imgLimits.maxCount) || 5;
  const foreign = r.currency && r.currency !== "CAD";
  const nItems = r.lots.reduce((a, l) => a + l.items.length, 0);
  const showFees = r.docType !== "cert" || exTotal(r) !== 0;
  const xf = (key, label) => `<div class="field"><label for="sc-x-${key}">${label}</label><input id="sc-x-${key}" type="number" step="0.01" inputmode="decimal" value="${r.ex[key] == null ? "" : r.ex[key].toFixed(2)}" placeholder="0.00"></div>`;
  body.innerHTML = `
    <p class="scan-src"><span class="pill grade">${DOC_LABEL[r.docType] || "Document"}</span><span class="muted sm">Check each line. Anything Claude couldn't read is left blank.</span></p>
    ${r.note ? `<div class="note warn"><p>${esc(r.note)}</p></div>` : ""}
    ${r.dropped ? `<div class="note warn"><p>Only the first ${max} images were read. Read the rest separately if they show more coins.</p></div>` : ""}
    ${foreign ? `<div class="note warn" id="sc-fx"><p>Amounts here are in ${esc(r.currency)}. Convert them so your costs match what you were charged in CAD.</p><div class="conv"><label for="sc-rate">CAD per 1 ${esc(r.currency)}</label><input id="sc-rate" type="number" step="0.0001" min="0" inputmode="decimal" placeholder="1.38"><button type="button" class="btn small" data-sh="sc-convert">Convert</button></div></div>` : ""}
    <section class="sec">
      <h3 class="eyebrow">Purchase</h3>
      <div class="grid2">
        <div class="field"><label for="sc-date">Date paid</label><input id="sc-date" type="date" value="${esc(r.orderDate || todayStr())}">${r.orderDate ? "" : `<span class="hint">Not on the document, so set to today</span>`}</div>
        <div class="field"><label for="sc-source">Bought from</label><input id="sc-source" list="dl-src" value="${esc(r.seller)}" placeholder="Seller, show, auction" autocomplete="off"></div>
        <div class="field"><label for="sc-ref">Order or invoice #</label><input id="sc-ref" value="${esc(r.orderRef)}" autocomplete="off"></div>
        <div class="field"><label for="sc-payfrom">Paid from</label>${paySel("sc-payfrom", lastPay("payFrom"))}</div>
      </div>
      <div class="field"><span class="lab" id="scs-lab">Status</span><div class="status-pick duo" role="radiogroup" aria-labelledby="scs-lab">
        <label class="sp in"><input type="radio" name="scstatus" id="sc-st-incoming" value="incoming"${status === "incoming" ? " checked" : ""}><span>Awaiting receipt</span></label>
        <label class="sp stock"><input type="radio" name="scstatus" id="sc-st-stock" value="stock"${status === "stock" ? " checked" : ""}><span>In stock</span></label>
      </div></div>
    </section>
    <section class="sec">
      <h3 class="eyebrow">Coins found · ${nItems}</h3>
      ${r.lots.map((l, L) => scanLotHTML(l, L)).join("")}
    </section>
    <section class="sec" id="sc-fees"${showFees ? "" : " hidden"}>
      <h3 class="eyebrow">Fees, shipping and tax</h3>
      <div class="grid2">${xf("ship", "Shipping and insurance")}${xf("bp", "Buyer's premium")}${xf("tax", "Tax")}${xf("other", "Other fees or discount")}</div>
      <p class="hint">These are spread across the coins you add in proportion to each coin's price, so every coin's cost includes its share.</p>
    </section>
    ${showFees ? "" : `<button type="button" class="linkbtn sm" id="sc-addfees" data-sh="sc-showfees">Add shipping, fees or tax</button>`}
    <section class="sec">
      <h3 class="eyebrow">Totals</h3>
      <div class="card stmt" id="sc-sum"></div>
    </section>
    ${dl("dl-grades", GRADES)}${dl("dl-src", [...state.coins.values()].map(x => x.source))}`;
  foot.innerHTML = `<button type="button" class="btn ghost" data-sh="sc-restart">Start over</button><span class="grow"></span><button type="submit" class="btn primary" id="sh-save">Add coins</button>`;
  body.scrollTop = 0;
  scanRecalc("");
}
function scanRecalc(skip){
  const f = panel.querySelector("#scan-form"), r = scan.result;
  if (!f || scan.step !== "review" || !r) return;
  allocFees(r);
  let nInc = 0, addTotal = 0;
  r.lots.forEach((l, L) => {
    const multi = l.items.length > 1;
    l.items.forEach((it, I) => {
      const k = L + "-" + I;
      const ip = f.querySelector("#sc-ip-" + k);
      if (ip && multi && ip.id !== skip) ip.value = it.price == null ? "" : it.price.toFixed(2);
      const cl = f.querySelector("#sc-cl-" + k);
      const cost = num((it.price || 0) + (it.fee || 0));
      if (it.inc){ nInc++; addTotal += cost; }
      if (cl) cl.innerHTML = it.inc
        ? `<span>Price <span class="fig">${fmt(it.price || 0)}</span></span><span>+ fees <span class="fig">${fmtS(it.fee || 0)}</span></span><span>= cost <b class="fig">${fmt(cost)}</b></span>`
        : `<span>Not being added</span>`;
    });
    if (multi){
      const lw = f.querySelector("#sc-lw-" + L);
      const s = num(l.items.reduce((a, it) => a + (it.price || 0), 0));
      if (lw){
        if (l.price != null && Math.abs(s - l.price) > 0.009){ lw.textContent = "Coin prices add up to " + fmt(s) + ", not the lot price of " + fmt(l.price) + "."; lw.classList.add("bad"); }
        else { lw.textContent = l.items.some(it => it.pinned) ? "Adjusted by hand. The other coins share what's left." : "Split evenly. Change a price and the rest of the lot adjusts."; lw.classList.remove("bad"); }
      }
    }
  });
  const itemsAll = num(r.lots.reduce((a, l) => a + lotAmount(l), 0)), ex = exTotal(r), orderTotal = num(itemsAll + ex);
  const off = r.total != null && Math.abs(orderTotal - r.total) > 0.02;
  const sum = f.querySelector("#sc-sum");
  if (sum) sum.innerHTML = `
    <div class="sl"><span class="lbl">Lots and coins</span><span class="fig">${fmt(itemsAll)}</span></div>
    <div class="sl"><span class="lbl">Fees, shipping and tax</span><span class="fig">${fmtS(ex)}</span></div>
    <div class="sl total"><span class="lbl">Order total</span><span class="fig">${fmtS(orderTotal)}</span></div>
    ${r.total != null ? `<div class="sl minor${off ? " warnrow" : ""}"><span class="lbl">${off ? "Doesn't match the document total. Check the prices and fees." : "Matches the document total"}</span><span class="fig">${fmt(r.total)}</span></div>` : ""}
    <div class="sl subtotal"><span class="lbl">Adding to inventory<small>${plural(nInc, "coin")}</small></span><span class="fig">${fmt(num(addTotal))}</span></div>`;
  const b = f.querySelector("#sh-save"); if (b){ b.textContent = nInc ? "Add " + plural(nInc, "coin") : "Add coins"; b.disabled = !nInc; }
}
function scanConvert(){
  const f = panel.querySelector("#scan-form"), r = scan.result; if (!f || !r) return;
  const rate = parseFloat((f.querySelector("#sc-rate") || {}).value);
  if (!(rate > 0)){ toast("Enter the exchange rate first."); return; }
  const cv = v => v == null ? null : num(v * rate);
  r.lots.forEach(l => {
    l.price = cv(l.price);
    l.items.forEach(it => { it.price = cv(it.price); });
    if (l.price != null && l.items.length > 1 && !l.items.some(it => it.pinned)) splitLot(l);
  });
  for (const k of ["ship", "bp", "tax", "other"]) r.ex[k] = cv(r.ex[k]);
  r.total = cv(r.total);
  r.converted = {from: r.currency, rate}; r.currency = "CAD";
  f.querySelectorAll('[id^="sc-lp-"]').forEach(inp => { const l = r.lots[+inp.id.slice(6)]; inp.value = l && l.price != null ? l.price.toFixed(2) : ""; });
  r.lots.forEach((l, L) => { if (l.items.length === 1){ const inp = f.querySelector("#sc-ip-" + L + "-0"); if (inp) inp.value = l.items[0].price == null ? "" : l.items[0].price.toFixed(2); } });
  for (const k of ["ship", "bp", "tax", "other"]){ const inp = f.querySelector("#sc-x-" + k); if (inp) inp.value = r.ex[k] == null ? "" : r.ex[k].toFixed(2); }
  const fx = f.querySelector("#sc-fx"); if (fx) fx.remove();
  scanRecalc(""); toast("Converted to CAD at " + rate);
}
function scanSubmit(f){
  if (scan.step === "pick"){ runScan(); return; }
  if (scan.step !== "review" || !scan.result) return;
  const g = i => f.querySelector("#" + i);
  const r = scan.result;
  allocFees(r);
  const status = (f.querySelector("input[name=scstatus]:checked") || {}).value || "incoming";
  const date = g("sc-date").value || todayStr(), source = g("sc-source").value.trim(), ref = g("sc-ref").value.trim(), payFrom = g("sc-payfrom").value;
  const rows = [];
  for (let L = 0; L < r.lots.length; L++){
    const l = r.lots[L];
    for (let I = 0; I < l.items.length; I++){
      const it = l.items[I], k = L + "-" + I;
      if (!it.inc) continue;
      const nameEl = g("sc-name-" + k), name = nameEl.value.trim();
      if (!name){ nameEl.setAttribute("aria-invalid", "true"); nameEl.focus(); toast("Each coin needs a name."); return; }
      rows.push({name, grader: g("sc-grader-" + k).value, grade: g("sc-grade-" + k).value.trim(), cert: g("sc-cert-" + k).value.trim(), variety: g("sc-var-" + k).value.trim(), comments: g("sc-com-" + k).value.trim(), cost: num(it.price || 0), fee: num(it.fee || 0), lotRef: l.ref, notes: it.notes});
    }
  }
  if (!rows.length){ toast("Tick at least one coin to add."); return; }
  const now = nowIso();
  const conv = r.converted ? "Converted from " + r.converted.from + " at " + r.converted.rate : (r.currency !== "CAD" ? "Amounts in " + r.currency : "");
  const writes = rows.map(x => ["set", "coins", newId("coins"), {
    name: x.name, grader: x.grader, grade: x.grade, cert: x.cert, variety: x.variety, comments: x.comments, status, boughtOn: date, source, cost: x.cost, buyFees: x.fee,
    gradeCost: 0, subId: "", soldOn: "", soldVia: "", salePrice: 0, saleFees: 0, shipCost: 0, payFrom, payTo: "",
    notes: [ref ? "Order " + ref : "", x.lotRef ? "Lot " + x.lotRef.replace(/^lot\s*#?\s*/i, "") : "", conv, x.notes].filter(Boolean).join(". "),
    created: now, updated: now
  }]);
  store.set("payFrom", payFrom);
  guarded(async () => {
    await runWrites(writes); closeSheet();
    state.tab = "inventory"; state.invFilter = status; state.invQuery = ""; store.set("tab", "inventory"); store.set("filter", status);
    render(); window.scrollTo({top: 0}); toast("Added " + plural(rows.length, "coin"));
  });
}

panel.addEventListener("click", e => {
  const b = e.target.closest("[data-sh]"); if (!b || !state.sheet) return;
  const a = b.dataset.sh, foot = panel.querySelector("#sh-foot");
  if (a === "close") closeSheet();
  else if (a === "ask-del" && foot){ state.sheet.foot = foot.innerHTML; foot.innerHTML = askHTML(state.sheet.what); }
  else if (a === "keep" && foot) foot.innerHTML = state.sheet.foot;
  else if (a === "del") state.sheet.onDelete && state.sheet.onDelete();
  else if (a === "pick") state.sheet.onPick && state.sheet.onPick(b.dataset.id);
  else if (state.sheet.onAction) state.sheet.onAction(a, b);
});
panel.addEventListener("dragover", e => { if (scanPicking()) e.preventDefault(); });
panel.addEventListener("drop", e => { if (!scanPicking()) return; e.preventDefault(); addScanFiles([...((e.dataTransfer && e.dataTransfer.files) || [])]); });
panel.addEventListener("submit", e => { e.preventDefault(); if (state.sheet && state.sheet.onSubmit) state.sheet.onSubmit(e.target); });
panel.addEventListener("input", e => { if (e.target.getAttribute("aria-invalid")) e.target.removeAttribute("aria-invalid"); if (state.sheet && state.sheet.onInput) state.sheet.onInput(e); });
panel.addEventListener("change", e => { if (state.sheet && state.sheet.onChange) state.sheet.onChange(e); });
sheet.querySelector(".scrim").addEventListener("click", () => { if (!state.busy) closeSheet(); });
document.addEventListener("keydown", e => { if (e.key === "Escape" && !sheet.hidden && !state.busy) closeSheet(); });

/* ---------- page events ---------- */
function needDb(){ if (!state.db){ toast(Platform.needDbText || "Open Coin Ledger in Claude to record entries."); return false; } return true; }
tabsEl.addEventListener("click", e => {
  const t = e.target.closest("[data-tab]"); if (!t) return;
  state.tab = t.dataset.tab; store.set("tab", state.tab); render(); window.scrollTo({top: 0});
});
main.addEventListener("click", e => {
  const b = e.target.closest("[data-act]"); if (!b) return;
  const a = b.dataset.act, id = b.dataset.id;
  switch (a){
    case "period": state.period = b.dataset.p; store.set("period", state.period); render(); break;
    case "goto-inv": state.tab = "inventory"; state.invFilter = b.dataset.f; store.set("tab", "inventory"); store.set("filter", state.invFilter); render(); window.scrollTo({top: 0}); break;
    case "inv-filter": state.invFilter = b.dataset.f; store.set("filter", state.invFilter); render(); break;
    case "chart": state.chartSel = Number(b.dataset.i); render(); break;
    case "new-coin": if (needDb()) openCoin(null); break;
    case "edit-coin": openCoin(id); break;
    case "record-sale": if (needDb()) openPicker(); break;
    case "collect": openCollect(b.dataset.b || ""); break;
    case "consign": if (needDb()) openConsign(null); break;
    case "list-coins": if (needDb()) openListing(); break;
    case "consign-results": openConsignResults(b.dataset.h || ""); break;
    case "new-sub": if (needDb()) openSub(null); break;
    case "edit-sub": openSub(id); break;
    case "return-sub": openSub(id, {status: "returned", returnedOn: todayStr()}); break;
    case "new-exp": if (needDb()) openExp(null); break;
    case "edit-exp": openExp(id); break;
    case "export-coins": exportCoins(); break;
    case "export-all": exportAll(); break;
    case "export-sales": exportSales(); break;
    case "export-exp": exportExpenses(); break;
    case "clear-ask": state.clearAsk = true; render(); break;
    case "clear-no": state.clearAsk = false; render(); break;
    case "clear-yes": clearExamples(); break;
    case "tab": state.tab = b.dataset.t; store.set("tab", state.tab); render(); window.scrollTo({top: 0}); break;
    case "scan": if (needDb()) openScan(); break;
    case "edit-acct": if (needDb()) openAcct(); break;
    case "new-move": if (needDb()) openMove(null, {kind: b.dataset.k}); break;
    case "money-filter": state.moneyFilter = b.dataset.f; render(); break;
    case "export-money": exportMoney(); break;
    case "led": { const col = b.dataset.col; if (col === "coins") openCoin(id); else if (col === "subs") openSub(id); else if (col === "expenses") openExp(id); else if (col === "moves") openMove(id); break; }
  }
});
main.addEventListener("input", e => {
  if (e.target.id === "inv-q"){ state.invQuery = e.target.value; const l = $("#inv-list"); if (l) l.innerHTML = invListHTML(); }
});
async function clearExamples(){
  if (!needDb() || state.busy) return;
  const writes = [];
  for (const [col, map] of [["coins", state.coins], ["subs", state.subs], ["expenses", state.expenses], ["accounts", state.accounts], ["moves", state.moves]])
    for (const [id, x] of map) if (x.example) writes.push(["del", col, id]);
  state.busy = true;
  try { await runWrites(writes); state.clearAsk = false; toast("Examples cleared"); }
  catch(e){ setSync(""); toast(errMsg(e)); }
  finally { state.busy = false; render(); }
}

/* ---------- start ---------- */
render();
if (Platform.start) Platform.start({state, render, toast, openSheet, closeSheet, footHTML, askHTML, esc, fmt, fmtS, fmtDate, todayStr, nowIso, num, plural, paySel, lastPay, store, setSync, runWrites, errMsg, scanErr, guarded, panel, sheet, $, ACCTS, ACCT_NAME});
})();
