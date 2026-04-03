import { useState, useEffect } from "react";
import { supabase } from "./supabase";
import { C } from "./constants";
import { DEFAULT_SETTINGS, rowToTrade, tradeToRow, rowToWL, wlToRow, rowToSettings, settingsToRow } from "./helpers";
import { Toast, ConfirmDialog } from "./components/Toast";
import Dashboard from "./components/Dashboard";
import Trades from "./components/Trades";
import Calc from "./components/Calc";
import Rules from "./components/Rules";
import Watchlist from "./components/Watchlist";
import Risk from "./components/Risk";

// ═══════════════════════════════════════════════════════════════
// STEINER TRADING TERMINAL v2.0
// Supabase-backed personal trading dashboard
// System: Swing/Position | Capital: <$10K | Style: Singles > HRs
// Deploy: trading.astridagent.ai via Coolify
// ═════════════════════════════════════════════════════════��═════

export default function App() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authMode, setAuthMode] = useState("login");
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [authErr, setAuthErr] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [tab, setTab] = useState("dashboard");
  const [trades, setTrades] = useState([]);
  const [watchlist, setWL] = useState([]);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [toasts, setToasts] = useState([]);
  const [confirm, setConfirm] = useState(null);

  const toast = (message, type = "success") => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3000);
  };
  const removeToast = (id) => setToasts(prev => prev.filter(t => t.id !== id));

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
      const [tRes, wRes, sRes] = await Promise.all([
        supabase.from("trades").select("*").order("created_at", { ascending: false }),
        supabase.from("watchlist").select("*").order("created_at", { ascending: false }),
        supabase.from("settings").select("*").eq("user_id", session.user.id).single(),
      ]);
      if (tRes.error) toast("Failed to load trades", "error");
      else setTrades(tRes.data.map(rowToTrade));
      if (wRes.error) toast("Failed to load watchlist", "error");
      else setWL(wRes.data.map(rowToWL));
      if (sRes.error && sRes.error.code !== "PGRST116") toast("Failed to load settings", "error");
      else setSettings(rowToSettings(sRes.data));
    };
    loadData();
  }, [session]);

  // Save settings to Supabase when they change
  useEffect(() => {
    if (!session) return;
    const timeout = setTimeout(async () => {
      const { error } = await supabase.from("settings").upsert(settingsToRow(settings, session.user.id));
      if (error) toast("Failed to save settings", "error");
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
    const { error } = await supabase.from("trades").insert(tradeToRow(trade, session.user.id));
    if (error) { setTrades(prev => prev.filter(t => t.id !== trade.id)); toast("Failed to save trade", "error"); }
    else toast("Trade logged");
  };
  const updateTrade = async (id, updates) => {
    const prev = trades.find(t => t.id === id);
    setTrades(p => p.map(t => t.id !== id ? t : { ...t, ...updates }));
    const dbUpdates = {};
    if (updates.status !== undefined) dbUpdates.status = updates.status;
    if (updates.closeDate !== undefined) dbUpdates.close_date = updates.closeDate;
    if (updates.closePrice !== undefined) dbUpdates.close_price = updates.closePrice;
    if (updates.pnl !== undefined) dbUpdates.pnl = updates.pnl;
    const { error } = await supabase.from("trades").update(dbUpdates).eq("id", id);
    if (error) { setTrades(p => p.map(t => t.id !== id ? t : prev)); toast("Failed to update trade", "error"); }
    else toast("Trade updated");
  };
  const deleteTrade = (id) => {
    const trade = trades.find(t => t.id === id);
    setConfirm({
      message: `Delete ${trade?.ticker || "this"} trade? This cannot be undone.`,
      onConfirm: async () => {
        setConfirm(null);
        setTrades(prev => prev.filter(t => t.id !== id));
        const { error } = await supabase.from("trades").delete().eq("id", id);
        if (error) { setTrades(prev => [trade, ...prev]); toast("Failed to delete trade", "error"); }
        else toast("Trade deleted");
      },
    });
  };
  const addWLItem = async (item) => {
    setWL(prev => [item, ...prev]);
    const { error } = await supabase.from("watchlist").insert(wlToRow(item, session.user.id));
    if (error) { setWL(prev => prev.filter(w => w.id !== item.id)); toast("Failed to save watchlist item", "error"); }
    else toast("Added to watchlist");
  };
  const updateWLItem = async (id, updates) => {
    const prev = watchlist.find(w => w.id === id);
    setWL(p => p.map(w => w.id !== id ? w : { ...w, ...updates }));
    const { error } = await supabase.from("watchlist").update(updates).eq("id", id);
    if (error) { setWL(p => p.map(w => w.id !== id ? w : prev)); toast("Failed to update watchlist", "error"); }
  };
  const deleteWLItem = (id) => {
    const item = watchlist.find(w => w.id === id);
    setConfirm({
      message: `Remove ${item?.ticker || "this item"} from watchlist?`,
      onConfirm: async () => {
        setConfirm(null);
        setWL(prev => prev.filter(w => w.id !== id));
        const { error } = await supabase.from("watchlist").delete().eq("id", id);
        if (error) { setWL(prev => [item, ...prev]); toast("Failed to delete watchlist item", "error"); }
        else toast("Removed from watchlist");
      },
    });
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
          <span style={{ color: C.textM, fontSize: 10 }}>v2.0</span>
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
        {tab === "dashboard" && <Dashboard {...{ trades, settings, curCap, totalPnL, winRate, open, closed, maxRisk$, wkPnL, consLoss }} />}
        {tab === "trades" && <Trades {...{ trades, addTrade, updateTrade, deleteTrade, settings, curCap }} />}
        {tab === "calc" && <Calc {...{ settings, setSettings, curCap }} />}
        {tab === "rules" && <Rules />}
        {tab === "watchlist" && <Watchlist {...{ watchlist, addWLItem, updateWLItem, deleteWLItem }} />}
        {tab === "risk" && <Risk {...{ trades, settings, curCap, closed, wkPnL, consLoss }} />}
      </div>
      <Toast toasts={toasts} removeToast={removeToast} />
      {confirm && <ConfirmDialog message={confirm.message} onConfirm={confirm.onConfirm} onCancel={() => setConfirm(null)} />}
      <style>{`
        @keyframes pulse { 0%,100% { opacity:1 } 50% { opacity:.5 } }
        @keyframes toastIn { from { opacity:0; transform:translateX(20px); } to { opacity:1; transform:translateX(0); } }
        input:focus,textarea:focus,select:focus { border-color: ${C.green} !important; outline:none; }
        ::-webkit-scrollbar { width:6px; height:6px; }
        ::-webkit-scrollbar-track { background:${C.bg}; }
        ::-webkit-scrollbar-thumb { background:${C.borderB}; border-radius:3px; }
        * { box-sizing:border-box; }
      `}</style>
    </div>
  );
}
