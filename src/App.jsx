import { useState, useEffect } from "react";
import { supabase } from "./supabase";
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";

// ═══════════════════════════════════════════════════════════════
// STEINER TRADING TERMINAL v2.0
// Supabase-backed personal trading dashboard
// System: Swing/Position | Capital: <$10K | Style: Singles > HRs
// Deploy: trading.astridagent.ai via Coolify
// ═══════════════════════════════════════════════════════════════

// ── Color System ──
const C = {
  bg: "#0a0a0f",
  bgCard: "#12121a",
  bgEl: "#1a1a25",
  bgIn: "#0e0e16",
  border: "#1e1e2e",
  borderB: "#2a2a3e",
  green: "#00e676",
  greenD: "rgba(0,230,118,0.1)",
  red: "#ff1744",
  redD: "rgba(255,23,68,0.1)",
  amber: "#ffab00",
  amberD: "rgba(255,171,0,0.1)",
  cyan: "#00e5ff",
  cyanD: "rgba(0,229,255,0.1)",
  purple: "#b388ff",
  purpleD: "rgba(179,136,255,0.1)",
  text: "#e8e8f0",
  textD: "#8888a0",
  textM: "#555570",
};

// ── Trading System Rules ──
const RULES = {
  name: "Steiner Swing System v1.0",
  philosophy: "Singles, not home runs. Protect capital. Let winners run. Cut losers fast.",
  risk: [
    { id: "R1", rule: "Never risk more than 1% of total capital per trade", detail: "With $10K, max risk = $100 per trade. If stop loss is $2 below entry, max position = 50 shares." },
    { id: "R2", rule: "Maximum 3 open positions at once", detail: "Concentration kills beginners. 3 positions means you can actually WATCH them." },
    { id: "R3", rule: "Never invest more than 20% of capital in one position", detail: "With $10K, max $2,000 per position. No all-in bets, ever." },
    { id: "R4", rule: "Stop trading after 3 consecutive losses", detail: "Step back. Review your journal. Are you following the system?" },
    { id: "R5", rule: "Weekly max loss: 3% of capital", detail: "Hit 3% loss for the week? Done. Close the apps. Come back Monday." },
    { id: "R6", rule: "No revenge trading — ever", detail: "Lost money? Do NOT immediately enter another trade to 'make it back.'" },
  ],
  entry: [
    { id: "E1", rule: "Only trade stocks above the 50-day moving average", detail: "This keeps you on the right side of the trend." },
    { id: "E2", rule: "Volume must be above average on entry day/week", detail: "Volume confirms price moves. Breakout on low volume = fake-out." },
    { id: "E3", rule: "Minimum 2:1 reward-to-risk ratio required", detail: "Risking $100? Target must be at least $200 profit." },
    { id: "E4", rule: "Entry triggers: breakout, bounce off support, or pullback to MA", detail: "If it doesn't fit one of these, it's not a trade." },
    { id: "E5", rule: "Check sector/market trend before entry", detail: "Is SPY/QQQ trending up? Is the sector strong? Both against you? Skip." },
    { id: "E6", rule: "Write thesis BEFORE entering", detail: "Can't explain in one sentence WHY? You don't have a trade." },
  ],
  exit: [
    { id: "X1", rule: "Set stop loss IMMEDIATELY at entry", detail: "Place the actual stop order so emotion can't override logic." },
    { id: "X2", rule: "Trail stop to breakeven after +1R gain", detail: "Once trade moves 1x risk in your favor, move stop to breakeven." },
    { id: "X3", rule: "Take 50% profit at 2R, let rest ride", detail: "Lock in gains. Let the remainder run with trailing stop." },
    { id: "X4", rule: "Hard exit if stock closes below 50-day MA", detail: "The trend changed. Your thesis is dead. Get out." },
    { id: "X5", rule: "Max hold time: 6 weeks for swing trades", detail: "Hasn't worked in 6 weeks? Free up the capital." },
    { id: "X6", rule: "Never turn a swing trade into an 'investment'", detail: "Your system said swing trade. Respect the system." },
  ],
  routine: [
    { day: "Saturday", task: "Weekly review — log all trades, calculate P&L, update watchlist." },
    { day: "Sunday", task: "Scan for setups — check charts on watchlist, set alerts for the week." },
    { day: "Mon-Fri AM", task: "Pre-market 7-9 AM — check news, gaps, volume. Execute planned entries ONLY." },
    { day: "Mon-Fri PM", task: "After close 5-6 PM — review positions, update stops, journal. 15 min max." },
  ],
  etfs: [
    { ticker: "SPY", name: "S&P 500", use: "Core trend-following. Buy pullbacks to 21 EMA in uptrends." },
    { ticker: "QQQ", name: "Nasdaq 100", use: "Tech momentum. Higher beta = tighter stops." },
    { ticker: "IWM", name: "Russell 2000", use: "Small cap rotation. Buy range breakouts." },
    { ticker: "XLF", name: "Financials", use: "Sector rotation. Strong when rates rise." },
    { ticker: "XLE", name: "Energy", use: "Commodity cycle plays. Follow oil." },
    { ticker: "GLD", name: "Gold", use: "Hedge / fear trade. Buy when market weakens." },
    { ticker: "TLT", name: "20+ Yr Treasuries", use: "Bond play. Flight to safety." },
  ],
};

// ── Helpers ──
const fmt = (n, d = 2) => (n == null || isNaN(n)) ? "—" : Number(n).toFixed(d);
const fUSD = (n) => (n == null || isNaN(n)) ? "—" : `$${Number(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fPct = (n) => (n == null || isNaN(n)) ? "—" : `${n >= 0 ? "+" : ""}${Number(n).toFixed(2)}%`;
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const td = () => new Date().toISOString().split("T")[0];

// ── Supabase DB helpers ──
const DEFAULT_SETTINGS = { capital: 10000, maxRiskPct: 1, maxPositions: 3, maxPosPct: 20 };

// Convert DB snake_case row to app camelCase
const rowToTrade = (r) => ({
  id: r.id, ticker: r.ticker, entry: Number(r.entry), stop: Number(r.stop), target: r.target ? Number(r.target) : null,
  shares: r.shares, thesis: r.thesis, date: r.date, type: r.type, status: r.status,
  riskPerShare: Number(r.risk_per_share), totalRisk: Number(r.total_risk), positionSize: Number(r.position_size),
  rr: Number(r.rr), closeDate: r.close_date, closePrice: r.close_price ? Number(r.close_price) : null, pnl: r.pnl ? Number(r.pnl) : null,
});
const tradeToRow = (t, userId) => ({
  id: t.id, user_id: userId, ticker: t.ticker, entry: t.entry, stop: t.stop, target: t.target,
  shares: t.shares, thesis: t.thesis, date: t.date, type: t.type, status: t.status,
  risk_per_share: t.riskPerShare, total_risk: t.totalRisk, position_size: t.positionSize,
  rr: t.rr, close_date: t.closeDate, close_price: t.closePrice, pnl: t.pnl,
});
const rowToWL = (r) => ({
  id: r.id, ticker: r.ticker, notes: r.notes, setup: r.setup, alert: r.alert ? Number(r.alert) : null, date: r.date, status: r.status,
});
const wlToRow = (w, userId) => ({
  id: w.id, user_id: userId, ticker: w.ticker, notes: w.notes, setup: w.setup, alert: w.alert, date: w.date, status: w.status,
});
const rowToSettings = (r) => r ? { capital: Number(r.capital), maxRiskPct: Number(r.max_risk_pct), maxPositions: r.max_positions, maxPosPct: Number(r.max_pos_pct) } : DEFAULT_SETTINGS;
const settingsToRow = (s, userId) => ({ user_id: userId, capital: s.capital, max_risk_pct: s.maxRiskPct, max_positions: s.maxPositions, max_pos_pct: s.maxPosPct });

// ══════════════════════════════════════════
// MAIN APP
// ══════════════════════════════════════════
export default function App() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authMode, setAuthMode] = useState("login"); // "login" | "signup"
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [authErr, setAuthErr] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [tab, setTab] = useState("dashboard");
  const [trades, setTrades] = useState([]);
  const [watchlist, setWL] = useState([]);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);

  // Listen for auth state changes
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => { setSession(s); setLoading(false); });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => subscription.unsubscribe();
  }, []);

  // Load data from Supabase when authenticated
  useEffect(() => {
    if (!session) return;
    const loadData = async () => {
      const [{ data: tData }, { data: wData }, { data: sData }] = await Promise.all([
        supabase.from("trades").select("*").order("created_at", { ascending: false }),
        supabase.from("watchlist").select("*").order("created_at", { ascending: false }),
        supabase.from("settings").select("*").eq("user_id", session.user.id).single(),
      ]);
      if (tData) setTrades(tData.map(rowToTrade));
      if (wData) setWL(wData.map(rowToWL));
      setSettings(rowToSettings(sData));
    };
    loadData();
  }, [session]);

  // Save settings to Supabase when they change
  useEffect(() => {
    if (!session) return;
    const timeout = setTimeout(() => {
      supabase.from("settings").upsert(settingsToRow(settings, session.user.id));
    }, 500);
    return () => clearTimeout(timeout);
  }, [settings, session]);

  const login = async () => {
    setAuthLoading(true); setAuthErr("");
    if (authMode === "signup") {
      const { error } = await supabase.auth.signUp({ email, password: pw });
      if (error) setAuthErr(error.message);
      else setAuthErr("Check your email for a confirmation link!");
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password: pw });
      if (error) setAuthErr(error.message);
    }
    setAuthLoading(false);
  };

  const logout = async () => { await supabase.auth.signOut(); setSession(null); setTrades([]); setWL([]); setSettings(DEFAULT_SETTINGS); };

  // ── CRUD wrappers that sync with Supabase ──
  const addTrade = async (trade) => {
    setTrades(prev => [trade, ...prev]);
    await supabase.from("trades").insert(tradeToRow(trade, session.user.id));
  };
  const updateTrade = async (id, updates) => {
    setTrades(prev => prev.map(t => t.id !== id ? t : { ...t, ...updates }));
    const dbUpdates = {};
    if (updates.status !== undefined) dbUpdates.status = updates.status;
    if (updates.closeDate !== undefined) dbUpdates.close_date = updates.closeDate;
    if (updates.closePrice !== undefined) dbUpdates.close_price = updates.closePrice;
    if (updates.pnl !== undefined) dbUpdates.pnl = updates.pnl;
    await supabase.from("trades").update(dbUpdates).eq("id", id);
  };
  const deleteTrade = async (id) => {
    setTrades(prev => prev.filter(t => t.id !== id));
    await supabase.from("trades").delete().eq("id", id);
  };
  const addWLItem = async (item) => {
    setWL(prev => [item, ...prev]);
    await supabase.from("watchlist").insert(wlToRow(item, session.user.id));
  };
  const updateWLItem = async (id, updates) => {
    setWL(prev => prev.map(w => w.id !== id ? w : { ...w, ...updates }));
    await supabase.from("watchlist").update(updates).eq("id", id);
  };
  const deleteWLItem = async (id) => {
    setWL(prev => prev.filter(w => w.id !== id));
    await supabase.from("watchlist").delete().eq("id", id);
  };

  if (loading) return (
    <div style={{ minHeight: "100vh", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'IBM Plex Mono', monospace" }}>
      <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600;700&family=Instrument+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
      <div style={{ color: C.green, fontSize: 14 }}>Loading...</div>
    </div>
  );

  if (!session) return (
    <div style={{ minHeight: "100vh", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'IBM Plex Mono', monospace" }}>
      <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600;700&family=Instrument+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
      <div style={{ textAlign: "center", maxWidth: 360, width: "100%" }}>
        <div style={{ fontSize: 11, letterSpacing: 4, color: C.green, marginBottom: 16, textTransform: "uppercase" }}>◆ Steiner Trading Terminal ◆</div>
        <div style={{ fontSize: 28, fontWeight: 800, color: C.text, marginBottom: 8, fontFamily: "'Instrument Sans', sans-serif" }}>Command Center</div>
        <div style={{ fontSize: 13, color: C.textM, marginBottom: 32 }}>{authMode === "login" ? "Sign in to continue" : "Create your account"}</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, padding: "0 20px" }}>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Email address"
            style={{ background: C.bgIn, border: `1px solid ${authErr && authErr !== "Check your email for a confirmation link!" ? C.red : C.border}`, borderRadius: 8, padding: "10px 16px", color: C.text, fontSize: 14, outline: "none", fontFamily: "inherit" }} />
          <input type="password" value={pw} onChange={e => setPw(e.target.value)} onKeyDown={e => e.key === "Enter" && login()} placeholder="Password (min 6 chars)"
            style={{ background: C.bgIn, border: `1px solid ${authErr && authErr !== "Check your email for a confirmation link!" ? C.red : C.border}`, borderRadius: 8, padding: "10px 16px", color: C.text, fontSize: 14, outline: "none", fontFamily: "inherit" }} />
          <button onClick={login} disabled={authLoading}
            style={{ background: C.green, color: "#000", border: "none", borderRadius: 8, padding: "10px 20px", fontSize: 13, fontWeight: 700, cursor: authLoading ? "wait" : "pointer", opacity: authLoading ? 0.7 : 1 }}>
            {authLoading ? "..." : authMode === "login" ? "SIGN IN" : "SIGN UP"}
          </button>
        </div>
        {authErr && <div style={{ color: authErr === "Check your email for a confirmation link!" ? C.green : C.red, fontSize: 12, marginTop: 12 }}>{authErr}</div>}
        <div style={{ marginTop: 20, fontSize: 12, color: C.textD }}>
          {authMode === "login" ? "No account? " : "Already have one? "}
          <span onClick={() => { setAuthMode(authMode === "login" ? "signup" : "login"); setAuthErr(""); }}
            style={{ color: C.green, cursor: "pointer", textDecoration: "underline" }}>
            {authMode === "login" ? "Sign up" : "Sign in"}
          </span>
        </div>
      </div>
    </div>
  );

  const open = trades.filter(t => t.status === "open");
  const closed = trades.filter(t => t.status === "closed");
  const totalPnL = closed.reduce((s, t) => s + (t.pnl || 0), 0);
  const winRate = closed.length ? (closed.filter(t => (t.pnl || 0) > 0).length / closed.length) * 100 : 0;
  const curCap = settings.capital + totalPnL;
  const maxRisk$ = curCap * (settings.maxRiskPct / 100);
  const consLoss = (() => { let c = 0; for (let i = closed.length - 1; i >= 0; i--) { if ((closed[i].pnl || 0) < 0) c++; else break; } return c; })();
  const wkStart = new Date(); wkStart.setDate(wkStart.getDate() - wkStart.getDay());
  const wkPnL = closed.filter(t => new Date(t.closeDate) >= wkStart).reduce((s, t) => s + (t.pnl || 0), 0);

  const TABS = [
    { id: "dashboard", label: "Dashboard", icon: "◈" },
    { id: "trades", label: "Trade Log", icon: "◉" },
    { id: "calc", label: "Position Sizer", icon: "⬡" },
    { id: "rules", label: "System Rules", icon: "◆" },
    { id: "watchlist", label: "Watchlist", icon: "◎" },
    { id: "risk", label: "Risk Tracker", icon: "△" },
  ];

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.text, fontFamily: "'IBM Plex Mono', monospace", fontSize: 13 }}>
      <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600;700&family=Instrument+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
      <div style={{ borderBottom: `1px solid ${C.border}`, padding: "12px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ color: C.green, fontSize: 10, letterSpacing: 3, textTransform: "uppercase" }}>◆ Steiner Trading Terminal</span>
          <span style={{ color: C.textM, fontSize: 10 }}>v1.0</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          {consLoss >= 3 && <span style={{ background: C.redD, color: C.red, padding: "4px 10px", borderRadius: 6, fontSize: 10, fontWeight: 700, animation: "pulse 2s infinite" }}>⚠ 3+ LOSSES — STOP TRADING</span>}
          {wkPnL < 0 && Math.abs(wkPnL) >= curCap * 0.03 && <span style={{ background: C.redD, color: C.red, padding: "4px 10px", borderRadius: 6, fontSize: 10, fontWeight: 700 }}>⚠ WEEKLY MAX LOSS</span>}
          <span style={{ color: C.textM, fontSize: 11 }}>{new Date().toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}</span>
          <span style={{ color: C.textD, fontSize: 10 }}>{session.user.email}</span>
          <button onClick={logout} style={{ background: "transparent", color: C.textM, border: `1px solid ${C.border}`, borderRadius: 6, padding: "4px 10px", fontSize: 10, cursor: "pointer", fontFamily: "inherit" }}>LOGOUT</button>
        </div>
      </div>

      <div style={{ display: "flex", gap: 2, padding: "8px 16px", borderBottom: `1px solid ${C.border}`, overflowX: "auto", flexWrap: "wrap" }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            background: tab === t.id ? C.green : "transparent", color: tab === t.id ? "#000" : C.textD,
            border: "none", borderRadius: 6, padding: "7px 14px", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap", transition: "all 0.15s"
          }}>{t.icon} {t.label}</button>
        ))}
      </div>

      <div style={{ padding: 20, maxWidth: 1100, margin: "0 auto" }}>
        {tab === "dashboard" && <Dash {...{ trades, settings, curCap, totalPnL, winRate, open, closed, maxRisk$, wkPnL, consLoss }} />}
        {tab === "trades" && <Trades {...{ trades, addTrade, updateTrade, deleteTrade, settings, curCap }} />}
        {tab === "calc" && <Calc {...{ settings, setSettings, curCap }} />}
        {tab === "rules" && <Rules />}
        {tab === "watchlist" && <WL {...{ watchlist, addWLItem, updateWLItem, deleteWLItem }} />}
        {tab === "risk" && <Risk {...{ trades, settings, curCap, closed, wkPnL, consLoss }} />}
      </div>
      <style>{`
        @keyframes pulse { 0%,100% { opacity:1 } 50% { opacity:.5 } }
        input:focus,textarea:focus,select:focus { border-color: ${C.green} !important; outline:none; }
        ::-webkit-scrollbar { width:6px; height:6px; }
        ::-webkit-scrollbar-track { background:${C.bg}; }
        ::-webkit-scrollbar-thumb { background:${C.borderB}; border-radius:3px; }
        * { box-sizing:border-box; }
      `}</style>
    </div>
  );
}

// ══════════════════════════════════════════
// STAT HELPERS
// ══════════════════════════════════════════
function Stat({ label, value, sub, color, icon }) {
  return (
    <div style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 10, padding: 18, flex: "1 1 140px", minWidth: 140 }}>
      <div style={{ fontSize: 10, color: C.textM, letterSpacing: 1, textTransform: "uppercase", marginBottom: 8 }}>{icon} {label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: color || C.text, fontFamily: "'Instrument Sans', sans-serif" }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: C.textD, marginTop: 4 }}>{sub}</div>}
    </div>
  );
}
function MRow({ label, value, color }) {
  return <div><div style={{ fontSize: 10, color: C.textM, marginBottom: 2 }}>{label}</div><div style={{ fontSize: 16, fontWeight: 700, color, fontFamily: "'Instrument Sans', sans-serif" }}>{value}</div></div>;
}
function SRow({ label, ok, text }) {
  return <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0" }}><span style={{ fontSize: 12, color: C.textD }}>{label}</span><span style={{ fontSize: 12, fontWeight: 600, color: ok ? C.green : C.red }}>{ok ? "✓" : "✗"} {text}</span></div>;
}

// ══════════════════════════════════════════
// DASHBOARD TAB
// ══════════════════════════════════════════
function Dash({ settings, curCap, totalPnL, winRate, open, closed, maxRisk$, wkPnL, consLoss }) {
  const ret = ((curCap - settings.capital) / settings.capital) * 100;
  const avgW = closed.filter(t => (t.pnl||0) > 0);
  const avgL = closed.filter(t => (t.pnl||0) < 0);
  const aW = avgW.length ? avgW.reduce((s,t) => s + t.pnl, 0) / avgW.length : 0;
  const aL = avgL.length ? avgL.reduce((s,t) => s + t.pnl, 0) / avgL.length : 0;
  const pf = aL !== 0 ? Math.abs(aW / aL) : 0;
  const mdd = (() => { let pk = settings.capital, mx = 0, r = settings.capital; closed.forEach(t => { r += (t.pnl||0); if (r > pk) pk = r; const d = ((pk-r)/pk)*100; if (d > mx) mx = d; }); return mx; })();

  return (
    <div>
      <div style={{ fontFamily: "'Instrument Sans', sans-serif", fontSize: 24, fontWeight: 700, marginBottom: 4 }}>Dashboard</div>
      <div style={{ color: C.textD, fontSize: 12, marginBottom: 24 }}>Your trading performance at a glance</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginBottom: 24 }}>
        <Stat icon="◈" label="Capital" value={fUSD(curCap)} sub={`Started: ${fUSD(settings.capital)}`} color={curCap >= settings.capital ? C.green : C.red} />
        <Stat icon="◉" label="Total P&L" value={fUSD(totalPnL)} sub={fPct(ret)} color={totalPnL >= 0 ? C.green : C.red} />
        <Stat icon="⬡" label="Win Rate" value={`${fmt(winRate,1)}%`} sub={`${avgW.length}W / ${avgL.length}L`} color={winRate >= 50 ? C.green : C.amber} />
        <Stat icon="△" label="Week P&L" value={fUSD(wkPnL)} sub="Resets Sunday" color={wkPnL >= 0 ? C.green : C.red} />
        <Stat icon="◆" label="Open" value={open.length} sub={`/ ${settings.maxPositions} max`} color={open.length >= settings.maxPositions ? C.amber : C.cyan} />
        <Stat icon="◎" label="Risk/Trade" value={fUSD(maxRisk$)} sub={`${settings.maxRiskPct}% of capital`} color={C.cyan} />
      </div>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 24 }}>
        <div style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 10, padding: 18, flex: 1, minWidth: 250 }}>
          <div style={{ fontSize: 11, color: C.textM, letterSpacing: 1, textTransform: "uppercase", marginBottom: 14 }}>◆ Performance</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <MRow label="Avg Win" value={fUSD(aW)} color={C.green} />
            <MRow label="Avg Loss" value={fUSD(aL)} color={C.red} />
            <MRow label="Profit Factor" value={fmt(pf,2)} color={pf >= 1.5 ? C.green : C.amber} />
            <MRow label="Max Drawdown" value={fPct(-mdd)} color={mdd > 10 ? C.red : C.amber} />
            <MRow label="Total Trades" value={closed.length} color={C.text} />
            <MRow label="Consec. Losses" value={consLoss} color={consLoss >= 3 ? C.red : C.text} />
          </div>
        </div>
        <div style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 10, padding: 18, flex: 1, minWidth: 250 }}>
          <div style={{ fontSize: 11, color: C.textM, letterSpacing: 1, textTransform: "uppercase", marginBottom: 14 }}>◆ System Status</div>
          <SRow label="Positions available" ok={open.length < settings.maxPositions} text={`${settings.maxPositions - open.length} of ${settings.maxPositions}`} />
          <SRow label="Weekly loss limit" ok={wkPnL > -(settings.capital * 0.03)} text={`${fUSD(wkPnL)} / ${fUSD(-settings.capital * 0.03)}`} />
          <SRow label="Consecutive losses" ok={consLoss < 3} text={`${consLoss} / 3 max`} />
          <SRow label="System compliance" ok={consLoss < 3 && open.length <= settings.maxPositions} text={consLoss < 3 && open.length <= settings.maxPositions ? "ALL CLEAR" : "CHECK RULES"} />
        </div>
      </div>
      {closed.length > 1 && (() => {
        const eqData = (() => { let r = settings.capital; return [{ name: "Start", equity: r }, ...closed.map(t => { r += (t.pnl||0); return { name: t.ticker, equity: parseFloat(r.toFixed(2)), date: t.closeDate }; })]; })();
        const pnlData = closed.map(t => ({ name: t.ticker, pnl: parseFloat((t.pnl||0).toFixed(2)), date: t.closeDate }));
        const chartTooltipStyle = { backgroundColor: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 12, fontFamily: "'IBM Plex Mono', monospace" };
        return (
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 24 }}>
            <div style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 10, padding: 18, flex: 1, minWidth: 300 }}>
              <div style={{ fontSize: 11, color: C.textM, letterSpacing: 1, textTransform: "uppercase", marginBottom: 14 }}>◈ Equity Curve</div>
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={eqData}>
                  <defs><linearGradient id="eqGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={C.green} stopOpacity={0.3}/><stop offset="95%" stopColor={C.green} stopOpacity={0}/></linearGradient></defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                  <XAxis dataKey="name" tick={{ fill: C.textM, fontSize: 10 }} stroke={C.border} />
                  <YAxis tick={{ fill: C.textM, fontSize: 10 }} stroke={C.border} tickFormatter={v => `$${v.toLocaleString()}`} domain={['dataMin - 50', 'dataMax + 50']} />
                  <Tooltip contentStyle={chartTooltipStyle} labelStyle={{ color: C.text }} formatter={(v) => [fUSD(v), "Equity"]} />
                  <ReferenceLine y={settings.capital} stroke={C.textM} strokeDasharray="3 3" label={{ value: "Start", fill: C.textM, fontSize: 10 }} />
                  <Area type="monotone" dataKey="equity" stroke={C.green} fill="url(#eqGrad)" strokeWidth={2} dot={{ fill: C.green, r: 3 }} activeDot={{ r: 5 }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 10, padding: 18, flex: 1, minWidth: 300 }}>
              <div style={{ fontSize: 11, color: C.textM, letterSpacing: 1, textTransform: "uppercase", marginBottom: 14 }}>◉ P&L Per Trade</div>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={pnlData}>
                  <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                  <XAxis dataKey="name" tick={{ fill: C.textM, fontSize: 10 }} stroke={C.border} />
                  <YAxis tick={{ fill: C.textM, fontSize: 10 }} stroke={C.border} tickFormatter={v => `$${v}`} />
                  <Tooltip contentStyle={chartTooltipStyle} labelStyle={{ color: C.text }} formatter={(v) => [fUSD(v), "P&L"]} />
                  <ReferenceLine y={0} stroke={C.textM} />
                  <Bar dataKey="pnl" radius={[4, 4, 0, 0]} fill={C.green} shape={(props) => {
                    const { x, y, width, height, payload } = props;
                    const fill = (payload.pnl || 0) >= 0 ? C.green : C.red;
                    return <rect x={x} y={y} width={width} height={height} fill={fill} rx={4} />;
                  }} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        );
      })()}
      {open.length > 0 && (
        <div style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 10, padding: 18 }}>
          <div style={{ fontSize: 11, color: C.textM, letterSpacing: 1, textTransform: "uppercase", marginBottom: 14 }}>◎ Open Positions</div>
          {open.map(t => (
            <div key={t.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: `1px solid ${C.border}`, flexWrap: "wrap", gap: 8 }}>
              <div><span style={{ fontWeight: 700, color: C.cyan }}>{t.ticker}</span><span style={{ color: C.textD, marginLeft: 8, fontSize: 11 }}>{t.shares} @ {fUSD(t.entry)}</span></div>
              <div style={{ fontSize: 11, color: C.textD }}>Stop: {fUSD(t.stop)} | Target: {fUSD(t.target)}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════
// TRADES TAB
// ══════════════════════════════════════════
function Trades({ trades, addTrade, updateTrade, deleteTrade, settings, curCap }) {
  const [show, setShow] = useState(false);
  const [f, setF] = useState({ ticker: "", entry: "", shares: "", stop: "", target: "", thesis: "", date: td(), type: "swing" });
  const [cfId, setCfId] = useState(null);
  const [cp, setCp] = useState("");
  const maxR = curCap * (settings.maxRiskPct / 100);
  const maxP = curCap * (settings.maxPosPct / 100);
  const openN = trades.filter(t => t.status === "open").length;
  const iS = { background: C.bgIn, border: `1px solid ${C.border}`, borderRadius: 6, padding: "8px 12px", color: C.text, fontSize: 13, fontFamily: "inherit", width: "100%" };

  const add = () => {
    const e = parseFloat(f.entry), s = parseFloat(f.stop), tg = parseFloat(f.target), sh = parseInt(f.shares);
    if (!f.ticker || isNaN(e) || isNaN(s) || isNaN(sh)) return;
    const rps = Math.abs(e - s), tr = rps * sh, ps = e * sh, rr = tg ? (tg - e) / rps : 0;
    addTrade({ id: uid(), ticker: f.ticker.toUpperCase(), entry: e, stop: s, target: tg, shares: sh, thesis: f.thesis, date: f.date, type: f.type, status: "open", riskPerShare: rps, totalRisk: tr, positionSize: ps, rr, closeDate: null, closePrice: null, pnl: null });
    setF({ ticker: "", entry: "", shares: "", stop: "", target: "", thesis: "", date: td(), type: "swing" });
    setShow(false);
  };

  const close = (id) => {
    const c = parseFloat(cp); if (isNaN(c)) return;
    const t = trades.find(t => t.id === id);
    updateTrade(id, { status: "closed", closeDate: td(), closePrice: c, pnl: (c - t.entry) * t.shares });
    setCfId(null); setCp("");
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 8 }}>
        <div>
          <div style={{ fontFamily: "'Instrument Sans', sans-serif", fontSize: 24, fontWeight: 700 }}>Trade Log</div>
          <div style={{ color: C.textD, fontSize: 12 }}>Every trade documented. No exceptions.</div>
        </div>
        <button onClick={() => setShow(!show)} style={{ background: C.green, color: "#000", border: "none", borderRadius: 8, padding: "8px 18px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>{show ? "CANCEL" : "+ NEW TRADE"}</button>
      </div>
      {openN >= settings.maxPositions && <div style={{ background: C.redD, border: `1px solid ${C.red}30`, borderRadius: 8, padding: 12, marginBottom: 16, fontSize: 12, color: C.red, fontWeight: 600 }}>⚠ MAX POSITIONS ({settings.maxPositions}). Close one before opening new.</div>}

      {show && (
        <div style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 10, padding: 20, marginBottom: 20 }}>
          <div style={{ fontSize: 11, color: C.green, letterSpacing: 1, textTransform: "uppercase", marginBottom: 16 }}>◆ New Trade Entry</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12 }}>
            <div><label style={{ fontSize: 10, color: C.textM, display: "block", marginBottom: 4 }}>TICKER</label><input style={iS} value={f.ticker} onChange={e => setF({...f, ticker: e.target.value})} placeholder="AAPL" /></div>
            <div><label style={{ fontSize: 10, color: C.textM, display: "block", marginBottom: 4 }}>ENTRY PRICE</label><input style={iS} type="number" step="0.01" value={f.entry} onChange={e => setF({...f, entry: e.target.value})} placeholder="150.00" /></div>
            <div><label style={{ fontSize: 10, color: C.textM, display: "block", marginBottom: 4 }}>SHARES</label><input style={iS} type="number" value={f.shares} onChange={e => setF({...f, shares: e.target.value})} placeholder="50" /></div>
            <div><label style={{ fontSize: 10, color: C.textM, display: "block", marginBottom: 4 }}>STOP LOSS</label><input style={iS} type="number" step="0.01" value={f.stop} onChange={e => setF({...f, stop: e.target.value})} placeholder="147.00" /></div>
            <div><label style={{ fontSize: 10, color: C.textM, display: "block", marginBottom: 4 }}>TARGET</label><input style={iS} type="number" step="0.01" value={f.target} onChange={e => setF({...f, target: e.target.value})} placeholder="156.00" /></div>
            <div><label style={{ fontSize: 10, color: C.textM, display: "block", marginBottom: 4 }}>DATE</label><input style={iS} type="date" value={f.date} onChange={e => setF({...f, date: e.target.value})} /></div>
            <div><label style={{ fontSize: 10, color: C.textM, display: "block", marginBottom: 4 }}>TYPE</label>
              <select style={iS} value={f.type} onChange={e => setF({...f, type: e.target.value})}><option value="swing">Swing</option><option value="position">Position</option><option value="etf">ETF</option></select>
            </div>
          </div>
          <div style={{ marginTop: 12 }}>
            <label style={{ fontSize: 10, color: C.textM, display: "block", marginBottom: 4 }}>THESIS — Why entering? (Rule E6)</label>
            <textarea style={{ ...iS, minHeight: 60, resize: "vertical" }} value={f.thesis} onChange={e => setF({...f, thesis: e.target.value})} placeholder="Breakout above resistance on high volume. SPY above 50MA." />
          </div>
          {f.entry && f.stop && f.shares && (() => {
            const e = parseFloat(f.entry), s = parseFloat(f.stop), sh = parseInt(f.shares), tg = parseFloat(f.target);
            const rps = Math.abs(e-s), risk = rps*sh, pos = e*sh, rr = tg ? (tg-e)/rps : 0;
            return (
              <div style={{ background: C.bgEl, borderRadius: 8, padding: 14, marginTop: 14 }}>
                <div style={{ fontSize: 10, color: C.textM, marginBottom: 8, letterSpacing: 1 }}>PRE-TRADE CHECK</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 16, fontSize: 12 }}>
                  <span style={{ color: risk <= maxR ? C.green : C.red, fontWeight: 600 }}>{risk <= maxR ? "✓" : "✗"} Risk: {fUSD(risk)} (max {fUSD(maxR)})</span>
                  <span style={{ color: pos <= maxP ? C.green : C.red, fontWeight: 600 }}>{pos <= maxP ? "✓" : "✗"} Size: {fUSD(pos)} (max {fUSD(maxP)})</span>
                  {tg > 0 && <span style={{ color: rr >= 2 ? C.green : C.red, fontWeight: 600 }}>{rr >= 2 ? "✓" : "✗"} R:R: {fmt(rr,1)}:1 (min 2:1)</span>}
                </div>
              </div>
            );
          })()}
          <button onClick={add} style={{ background: C.green, color: "#000", border: "none", borderRadius: 8, padding: "10px 24px", fontSize: 12, fontWeight: 700, cursor: "pointer", marginTop: 14 }}>LOG TRADE</button>
        </div>
      )}

      {trades.length === 0 ? (
        <div style={{ textAlign: "center", padding: 60, color: C.textM }}><div style={{ fontSize: 32, marginBottom: 12 }}>◎</div><div>No trades logged yet.</div></div>
      ) : trades.map(t => (
        <div key={t.id} style={{ background: C.bgCard, border: `1px solid ${t.status === "open" ? C.cyanD : (t.pnl||0) >= 0 ? C.greenD : C.redD}`, borderRadius: 10, padding: 16, marginBottom: 8 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontWeight: 700, fontSize: 16, color: t.status === "open" ? C.cyan : (t.pnl||0) >= 0 ? C.green : C.red, fontFamily: "'Instrument Sans',sans-serif" }}>{t.ticker}</span>
              <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 4, background: t.status === "open" ? C.cyanD : (t.pnl||0) >= 0 ? C.greenD : C.redD, color: t.status === "open" ? C.cyan : (t.pnl||0) >= 0 ? C.green : C.red, fontWeight: 600 }}>{t.status === "open" ? "OPEN" : (t.pnl||0) >= 0 ? "WIN" : "LOSS"}</span>
              <span style={{ fontSize: 10, color: C.textM, textTransform: "uppercase" }}>{t.type}</span>
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              {t.status === "open" && (cfId === t.id ? (
                <div style={{ display: "flex", gap: 4 }}>
                  <input type="number" step="0.01" placeholder="Close $" value={cp} onChange={e => setCp(e.target.value)} style={{ ...iS, width: 100, padding: "4px 8px", fontSize: 11 }} />
                  <button onClick={() => close(t.id)} style={{ background: C.green, color: "#000", border: "none", borderRadius: 4, padding: "4px 10px", fontSize: 10, fontWeight: 700, cursor: "pointer" }}>CLOSE</button>
                  <button onClick={() => { setCfId(null); setCp(""); }} style={{ background: C.bgEl, color: C.textD, border: `1px solid ${C.border}`, borderRadius: 4, padding: "4px 8px", fontSize: 10, cursor: "pointer" }}>✗</button>
                </div>
              ) : <button onClick={() => setCfId(t.id)} style={{ background: C.amberD, color: C.amber, border: "none", borderRadius: 4, padding: "4px 10px", fontSize: 10, fontWeight: 600, cursor: "pointer" }}>CLOSE TRADE</button>)}
              <button onClick={() => deleteTrade(t.id)} style={{ background: "transparent", color: C.textM, border: `1px solid ${C.border}`, borderRadius: 4, padding: "4px 8px", fontSize: 10, cursor: "pointer" }}>✗</button>
            </div>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 16, marginTop: 10, fontSize: 11, color: C.textD }}>
            <span>Entry: <strong style={{ color: C.text }}>{fUSD(t.entry)}</strong></span>
            <span>{t.shares} shares</span>
            <span>Stop: <strong style={{ color: C.red }}>{fUSD(t.stop)}</strong></span>
            <span>Target: <strong style={{ color: C.green }}>{fUSD(t.target)}</strong></span>
            <span>Risk: <strong style={{ color: C.amber }}>{fUSD(t.totalRisk)}</strong></span>
            <span>R:R: <strong style={{ color: t.rr >= 2 ? C.green : C.red }}>{fmt(t.rr,1)}:1</strong></span>
            {t.status === "closed" && <span>P&L: <strong style={{ color: (t.pnl||0) >= 0 ? C.green : C.red }}>{fUSD(t.pnl)}</strong></span>}
          </div>
          {t.thesis && <div style={{ fontSize: 11, color: C.textD, marginTop: 8, fontStyle: "italic", borderLeft: `2px solid ${C.border}`, paddingLeft: 10 }}>{t.thesis}</div>}
          <div style={{ fontSize: 10, color: C.textM, marginTop: 6 }}>{t.date}{t.closeDate ? ` → ${t.closeDate}` : ""}</div>
        </div>
      ))}
    </div>
  );
}

// ══════════════════════════════════════════
// POSITION SIZER
// ══════════════════════════════════════════
function Calc({ settings, setSettings, curCap }) {
  const [entry, setEntry] = useState("");
  const [stop, setStop] = useState("");
  const [target, setTarget] = useState("");
  const riskD = curCap * (settings.maxRiskPct / 100);
  const maxPD = curCap * (settings.maxPosPct / 100);
  const eN = parseFloat(entry), sN = parseFloat(stop), tN = parseFloat(target);
  const rps = eN && sN ? Math.abs(eN - sN) : 0;
  const idealSh = rps > 0 ? Math.floor(riskD / rps) : 0;
  const maxSh = eN > 0 ? Math.floor(maxPD / eN) : 0;
  const finalSh = Math.min(idealSh, maxSh);
  const posVal = finalSh * eN, totRisk = finalSh * rps;
  const rr = rps > 0 && tN ? (tN - eN) / rps : 0;
  const potProfit = finalSh * (tN - eN);
  const iS = { background: C.bgIn, border: `1px solid ${C.border}`, borderRadius: 6, padding: "10px 14px", color: C.text, fontSize: 15, fontFamily: "inherit", width: "100%", fontWeight: 600 };

  return (
    <div>
      <div style={{ fontFamily: "'Instrument Sans', sans-serif", fontSize: 24, fontWeight: 700, marginBottom: 4 }}>Position Size Calculator</div>
      <div style={{ color: C.textD, fontSize: 12, marginBottom: 24 }}>The calculator enforces discipline.</div>
      <div style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 10, padding: 18, marginBottom: 20 }}>
        <div style={{ fontSize: 10, color: C.textM, letterSpacing: 1, textTransform: "uppercase", marginBottom: 12 }}>◆ Account Settings</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
          <div><label style={{ fontSize: 10, color: C.textM, display: "block", marginBottom: 4 }}>STARTING CAPITAL</label><input style={iS} type="number" value={settings.capital} onChange={e => setSettings({...settings, capital: parseFloat(e.target.value)||0})} /></div>
          <div><label style={{ fontSize: 10, color: C.textM, display: "block", marginBottom: 4 }}>MAX RISK %</label><input style={iS} type="number" step="0.25" value={settings.maxRiskPct} onChange={e => setSettings({...settings, maxRiskPct: parseFloat(e.target.value)||1})} /></div>
          <div><label style={{ fontSize: 10, color: C.textM, display: "block", marginBottom: 4 }}>MAX POSITIONS</label><input style={iS} type="number" value={settings.maxPositions} onChange={e => setSettings({...settings, maxPositions: parseInt(e.target.value)||3})} /></div>
          <div><label style={{ fontSize: 10, color: C.textM, display: "block", marginBottom: 4 }}>MAX POS %</label><input style={iS} type="number" step="5" value={settings.maxPosPct} onChange={e => setSettings({...settings, maxPosPct: parseFloat(e.target.value)||20})} /></div>
        </div>
        <div style={{ fontSize: 11, color: C.green, marginTop: 12 }}>Current capital: <strong>{fUSD(curCap)}</strong> → Max risk/trade: <strong>{fUSD(riskD)}</strong></div>
      </div>
      <div style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 10, padding: 18 }}>
        <div style={{ fontSize: 10, color: C.green, letterSpacing: 1, textTransform: "uppercase", marginBottom: 16 }}>⬡ Calculate</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: 20 }}>
          <div><label style={{ fontSize: 10, color: C.textM, display: "block", marginBottom: 4 }}>ENTRY PRICE</label><input style={iS} type="number" step="0.01" value={entry} onChange={e => setEntry(e.target.value)} placeholder="0.00" /></div>
          <div><label style={{ fontSize: 10, color: C.textM, display: "block", marginBottom: 4 }}>STOP LOSS</label><input style={iS} type="number" step="0.01" value={stop} onChange={e => setStop(e.target.value)} placeholder="0.00" /></div>
          <div><label style={{ fontSize: 10, color: C.textM, display: "block", marginBottom: 4 }}>TARGET</label><input style={iS} type="number" step="0.01" value={target} onChange={e => setTarget(e.target.value)} placeholder="0.00" /></div>
        </div>
        {eN > 0 && sN > 0 && (
          <div style={{ background: C.bgEl, borderRadius: 10, padding: 20, border: `1px solid ${C.borderB}` }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 16, textAlign: "center" }}>
              <div><div style={{ fontSize: 10, color: C.textM, letterSpacing: 1, marginBottom: 4 }}>SHARES TO BUY</div><div style={{ fontSize: 32, fontWeight: 700, color: C.green, fontFamily: "'Instrument Sans',sans-serif" }}>{finalSh}</div></div>
              <div><div style={{ fontSize: 10, color: C.textM, letterSpacing: 1, marginBottom: 4 }}>POSITION VALUE</div><div style={{ fontSize: 20, fontWeight: 700, color: C.text, fontFamily: "'Instrument Sans',sans-serif" }}>{fUSD(posVal)}</div></div>
              <div><div style={{ fontSize: 10, color: C.textM, letterSpacing: 1, marginBottom: 4 }}>TOTAL RISK</div><div style={{ fontSize: 20, fontWeight: 700, color: C.red, fontFamily: "'Instrument Sans',sans-serif" }}>{fUSD(totRisk)}</div></div>
              {tN > 0 && <div><div style={{ fontSize: 10, color: C.textM, letterSpacing: 1, marginBottom: 4 }}>R:R RATIO</div><div style={{ fontSize: 20, fontWeight: 700, color: rr >= 2 ? C.green : C.red, fontFamily: "'Instrument Sans',sans-serif" }}>{fmt(rr,1)}:1</div></div>}
              {tN > 0 && <div><div style={{ fontSize: 10, color: C.textM, letterSpacing: 1, marginBottom: 4 }}>POTENTIAL PROFIT</div><div style={{ fontSize: 20, fontWeight: 700, color: C.green, fontFamily: "'Instrument Sans',sans-serif" }}>{fUSD(potProfit)}</div></div>}
            </div>
            {idealSh > maxSh && <div style={{ marginTop: 14, fontSize: 11, color: C.amber, background: C.amberD, padding: 10, borderRadius: 6 }}>⚠ Capped by {settings.maxPosPct}% rule ({idealSh} → {finalSh} shares)</div>}
            {rr > 0 && rr < 2 && <div style={{ marginTop: 10, fontSize: 11, color: C.red, background: C.redD, padding: 10, borderRadius: 6 }}>⚠ R:R below 2:1. Rule E3: trade does NOT qualify.</div>}
          </div>
        )}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════
// SYSTEM RULES
// ══════════════════════════════════════════
function Rules() {
  const [exp, setExp] = useState(null);
  const Sec = ({ title, rules, color, icon }) => (
    <div style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 10, padding: 18, marginBottom: 16 }}>
      <div style={{ fontSize: 12, color, letterSpacing: 1, textTransform: "uppercase", marginBottom: 14, fontWeight: 700 }}>{icon} {title}</div>
      {rules.map(r => (
        <div key={r.id} onClick={() => setExp(exp === r.id ? null : r.id)} style={{ cursor: "pointer", padding: "10px 0", borderBottom: `1px solid ${C.border}` }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
            <span style={{ color, fontWeight: 700, fontSize: 11, minWidth: 24 }}>{r.id}</span>
            <span style={{ color: C.text, fontSize: 13, fontWeight: 500 }}>{r.rule}</span>
            <span style={{ color: C.textM, marginLeft: "auto", fontSize: 10 }}>{exp === r.id ? "▲" : "▼"}</span>
          </div>
          {exp === r.id && <div style={{ marginTop: 8, marginLeft: 34, fontSize: 12, color: C.textD, lineHeight: 1.6, background: C.bgEl, padding: 12, borderRadius: 6 }}>{r.detail}</div>}
        </div>
      ))}
    </div>
  );

  return (
    <div>
      <div style={{ fontFamily: "'Instrument Sans', sans-serif", fontSize: 24, fontWeight: 700, marginBottom: 4 }}>System Rules</div>
      <div style={{ color: C.textD, fontSize: 12, marginBottom: 8 }}>{RULES.name}</div>
      <div style={{ color: C.green, fontSize: 13, fontStyle: "italic", marginBottom: 24, borderLeft: `2px solid ${C.green}`, paddingLeft: 12 }}>"{RULES.philosophy}"</div>
      <Sec title="Risk Management" rules={RULES.risk} color={C.red} icon="△" />
      <Sec title="Entry Rules" rules={RULES.entry} color={C.green} icon="◈" />
      <Sec title="Exit Rules" rules={RULES.exit} color={C.amber} icon="◉" />
      <div style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 10, padding: 18, marginBottom: 16 }}>
        <div style={{ fontSize: 12, color: C.cyan, letterSpacing: 1, textTransform: "uppercase", marginBottom: 14, fontWeight: 700 }}>◎ Weekly Routine</div>
        {RULES.routine.map((r, i) => (
          <div key={i} style={{ display: "flex", gap: 12, padding: "8px 0", borderBottom: `1px solid ${C.border}` }}>
            <span style={{ color: C.cyan, fontWeight: 700, fontSize: 11, minWidth: 80 }}>{r.day}</span>
            <span style={{ color: C.textD, fontSize: 12 }}>{r.task}</span>
          </div>
        ))}
      </div>
      <div style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 10, padding: 18 }}>
        <div style={{ fontSize: 12, color: C.purple, letterSpacing: 1, textTransform: "uppercase", marginBottom: 14, fontWeight: 700 }}>◆ ETF Playbook</div>
        {RULES.etfs.map((e, i) => (
          <div key={i} style={{ display: "flex", gap: 12, padding: "8px 0", borderBottom: `1px solid ${C.border}` }}>
            <span style={{ color: C.purple, fontWeight: 700, fontSize: 13, minWidth: 40, fontFamily: "'Instrument Sans',sans-serif" }}>{e.ticker}</span>
            <div><span style={{ color: C.text, fontSize: 12, fontWeight: 500 }}>{e.name}</span><div style={{ color: C.textD, fontSize: 11, marginTop: 2 }}>{e.use}</div></div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════
// WATCHLIST
// ══════════════════════════════════════════
function WL({ watchlist, addWLItem, updateWLItem, deleteWLItem }) {
  const [f, setF] = useState({ ticker: "", notes: "", setup: "breakout", alert: "" });
  const iS = { background: C.bgIn, border: `1px solid ${C.border}`, borderRadius: 6, padding: "8px 12px", color: C.text, fontSize: 13, fontFamily: "inherit", width: "100%" };
  const sCol = { watching: C.textD, ready: C.amber, triggered: C.green };
  const sLbl = { watching: "WATCHING", ready: "READY", triggered: "TRIGGERED" };

  const add = () => {
    if (!f.ticker) return;
    addWLItem({ id: uid(), ticker: f.ticker.toUpperCase(), notes: f.notes, setup: f.setup, alert: f.alert ? parseFloat(f.alert) : null, date: td(), status: "watching" });
    setF({ ticker: "", notes: "", setup: "breakout", alert: "" });
  };

  const cycleStatus = (w) => {
    const next = w.status === "watching" ? "ready" : w.status === "ready" ? "triggered" : "watching";
    updateWLItem(w.id, { status: next });
  };

  return (
    <div>
      <div style={{ fontFamily: "'Instrument Sans', sans-serif", fontSize: 24, fontWeight: 700, marginBottom: 4 }}>Watchlist</div>
      <div style={{ color: C.textD, fontSize: 12, marginBottom: 24 }}>Sunday scan → Monday entries.</div>
      <div style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 10, padding: 18, marginBottom: 20 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12 }}>
          <div><label style={{ fontSize: 10, color: C.textM, display: "block", marginBottom: 4 }}>TICKER</label><input style={iS} value={f.ticker} onChange={e => setF({...f, ticker: e.target.value})} placeholder="MSFT" /></div>
          <div><label style={{ fontSize: 10, color: C.textM, display: "block", marginBottom: 4 }}>SETUP</label>
            <select style={iS} value={f.setup} onChange={e => setF({...f, setup: e.target.value})}><option value="breakout">Breakout</option><option value="pullback">Pullback to MA</option><option value="bounce">Bounce off Support</option><option value="etf">ETF Rotation</option><option value="other">Other</option></select>
          </div>
          <div><label style={{ fontSize: 10, color: C.textM, display: "block", marginBottom: 4 }}>ALERT PRICE</label><input style={iS} type="number" step="0.01" value={f.alert} onChange={e => setF({...f, alert: e.target.value})} placeholder="0.00" /></div>
        </div>
        <div style={{ marginTop: 12 }}><label style={{ fontSize: 10, color: C.textM, display: "block", marginBottom: 4 }}>NOTES</label><input style={iS} value={f.notes} onChange={e => setF({...f, notes: e.target.value})} placeholder="Consolidating near resistance. Watch volume." /></div>
        <button onClick={add} style={{ background: C.green, color: "#000", border: "none", borderRadius: 8, padding: "8px 18px", fontSize: 12, fontWeight: 700, cursor: "pointer", marginTop: 12 }}>+ ADD</button>
      </div>
      {watchlist.length === 0 ? (
        <div style={{ textAlign: "center", padding: 60, color: C.textM }}><div style={{ fontSize: 32, marginBottom: 12 }}>◎</div><div>Empty. Do your Sunday scan.</div></div>
      ) : watchlist.map(w => (
        <div key={w.id} style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 10, padding: 14, marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1 }}>
            <span style={{ fontWeight: 700, fontSize: 15, color: C.text, fontFamily: "'Instrument Sans',sans-serif", minWidth: 50 }}>{w.ticker}</span>
            <span onClick={() => cycleStatus(w)}
              style={{ fontSize: 10, padding: "2px 8px", borderRadius: 4, background: `${sCol[w.status]}20`, color: sCol[w.status], fontWeight: 600, cursor: "pointer", textTransform: "uppercase" }}>{sLbl[w.status]}</span>
            <span style={{ fontSize: 10, color: C.textM, textTransform: "uppercase" }}>{w.setup}</span>
            {w.alert && <span style={{ fontSize: 11, color: C.amber }}>@ {fUSD(w.alert)}</span>}
          </div>
          {w.notes && <div style={{ fontSize: 11, color: C.textD, flex: "1 1 100%" }}>{w.notes}</div>}
          <button onClick={() => deleteWLItem(w.id)} style={{ background: "transparent", color: C.textM, border: `1px solid ${C.border}`, borderRadius: 4, padding: "4px 8px", fontSize: 10, cursor: "pointer" }}>✗</button>
        </div>
      ))}
    </div>
  );
}

// ══════════════════════════════════════════
// RISK TRACKER
// ══════════════════════════════════════════
function Risk({ trades, settings, curCap, closed, wkPnL, consLoss }) {
  const open = trades.filter(t => t.status === "open");
  const totOR = open.reduce((s, t) => s + (t.totalRisk || 0), 0);
  const totExp = open.reduce((s, t) => s + (t.positionSize || 0), 0);
  const expPct = (totExp / curCap) * 100;
  const wkLim = curCap * 0.03;
  const mdd = (() => { let pk = settings.capital, mx = 0, r = settings.capital; closed.forEach(t => { r += (t.pnl||0); if (r > pk) pk = r; const d = ((pk-r)/pk)*100; if (d > mx) mx = d; }); return mx; })();
  const eq = (() => { let r = settings.capital; return [{ name: "Start", equity: r }, ...closed.map(t => { r += (t.pnl||0); return { name: t.ticker, equity: parseFloat(r.toFixed(2)), date: t.closeDate }; })]; })();

  const Gauge = ({ label, value, max, unit, color, pre = "" }) => {
    const pct = Math.min((value / max) * 100, 100);
    return (
      <div style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 10, padding: 16 }}>
        <div style={{ fontSize: 10, color: C.textM, letterSpacing: 1, textTransform: "uppercase", marginBottom: 8 }}>{label}</div>
        <div style={{ fontSize: 20, fontWeight: 700, color, fontFamily: "'Instrument Sans',sans-serif", marginBottom: 8 }}>{pre}{unit === "$" ? fUSD(value) : `${fmt(value,1)}%`}</div>
        <div style={{ height: 6, background: C.bgEl, borderRadius: 3, overflow: "hidden" }}><div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: 3, transition: "width 0.5s" }} /></div>
        <div style={{ fontSize: 10, color: C.textM, marginTop: 4 }}>of {unit === "$" ? fUSD(max) : `${max}%`} limit</div>
      </div>
    );
  };

  return (
    <div>
      <div style={{ fontFamily: "'Instrument Sans', sans-serif", fontSize: 24, fontWeight: 700, marginBottom: 4 }}>Risk & Drawdown</div>
      <div style={{ color: C.textD, fontSize: 12, marginBottom: 24 }}>Capital preservation is job #1.</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12, marginBottom: 24 }}>
        <Gauge label="Open Risk" value={totOR} max={curCap * (settings.maxRiskPct/100) * settings.maxPositions} unit="$" color={C.red} />
        <Gauge label="Exposure" value={expPct} max={100} unit="%" color={C.amber} />
        <Gauge label="Weekly P&L" value={Math.abs(wkPnL)} max={wkLim} unit="$" color={wkPnL >= 0 ? C.green : C.red} pre={wkPnL >= 0 ? "+" : "-"} />
        <Gauge label="Max Drawdown" value={mdd} max={15} unit="%" color={mdd > 10 ? C.red : mdd > 5 ? C.amber : C.green} />
      </div>
      {eq.length > 1 && (
        <div style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 10, padding: 18, marginBottom: 20 }}>
          <div style={{ fontSize: 11, color: C.textM, letterSpacing: 1, textTransform: "uppercase", marginBottom: 14 }}>◈ Equity Curve</div>
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={eq}>
              <defs><linearGradient id="riskEqGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={C.cyan} stopOpacity={0.3}/><stop offset="95%" stopColor={C.cyan} stopOpacity={0}/></linearGradient></defs>
              <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
              <XAxis dataKey="name" tick={{ fill: C.textM, fontSize: 10 }} stroke={C.border} />
              <YAxis tick={{ fill: C.textM, fontSize: 10 }} stroke={C.border} tickFormatter={v => `$${v.toLocaleString()}`} domain={['dataMin - 50', 'dataMax + 50']} />
              <Tooltip contentStyle={{ backgroundColor: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 12, fontFamily: "'IBM Plex Mono', monospace" }} labelStyle={{ color: C.text }} formatter={(v) => [fUSD(v), "Equity"]} />
              <ReferenceLine y={settings.capital} stroke={C.textM} strokeDasharray="3 3" label={{ value: "Start", fill: C.textM, fontSize: 10 }} />
              <Area type="monotone" dataKey="equity" stroke={C.cyan} fill="url(#riskEqGrad)" strokeWidth={2} dot={{ fill: C.cyan, r: 3 }} activeDot={{ r: 5 }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
      {open.length > 0 && (
        <div style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 10, padding: 18 }}>
          <div style={{ fontSize: 11, color: C.textM, letterSpacing: 1, textTransform: "uppercase", marginBottom: 14 }}>◉ Position Risk</div>
          {open.map(t => (
            <div key={t.id} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: `1px solid ${C.border}`, fontSize: 12, flexWrap: "wrap", gap: 8 }}>
              <span style={{ color: C.cyan, fontWeight: 700 }}>{t.ticker}</span>
              <span style={{ color: C.textD }}>{t.shares} shares</span>
              <span style={{ color: C.textD }}>Size: {fUSD(t.positionSize)}</span>
              <span style={{ color: C.red }}>Risk: {fUSD(t.totalRisk)}</span>
              <span style={{ color: C.textD }}>{fmt((t.positionSize/curCap)*100,1)}%</span>
            </div>
          ))}
          <div style={{ display: "flex", justifyContent: "space-between", paddingTop: 10, fontSize: 12, fontWeight: 700, flexWrap: "wrap", gap: 8 }}>
            <span style={{ color: C.text }}>TOTAL</span>
            <span style={{ color: C.text }}>{fUSD(totExp)}</span>
            <span style={{ color: C.red }}>{fUSD(totOR)}</span>
            <span style={{ color: C.text }}>{fmt(expPct,1)}%</span>
          </div>
        </div>
      )}
    </div>
  );
}
