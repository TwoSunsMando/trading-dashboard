import { useState, useEffect } from "react";
import { supabase } from "./supabase";
import { DEFAULT_SETTINGS, rowToTrade, tradeToRow, rowToWL, wlToRow, rowToSettings, settingsToRow } from "./helpers";
import { Toast, ConfirmDialog } from "./components/Toast";
import Dashboard from "./components/Dashboard";
import Trades from "./components/Trades";
import Calc from "./components/Calc";
import Rules from "./components/Rules";
import Watchlist from "./components/Watchlist";
import Risk from "./components/Risk";
import Coach from "./components/Coach";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

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

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => { setSession(s); setLoading(false); });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => subscription.unsubscribe();
  }, []);

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
    if (updates.journalLessons !== undefined) dbUpdates.journal_lessons = updates.journalLessons || null;
    if (updates.journalMistakes !== undefined) dbUpdates.journal_mistakes = updates.journalMistakes || null;
    if (updates.followedRules !== undefined) dbUpdates.followed_rules = updates.followedRules;
    if (updates.emotion !== undefined) dbUpdates.emotion = updates.emotion || null;
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
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-profit text-sm animate-pulse">Loading...</div>
    </div>
  );

  if (!session) return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="text-center max-w-[360px] w-full">
        <div className="text-xs tracking-[4px] text-primary mb-4 uppercase font-medium">Steiner Trading Terminal</div>
        <h1 className="text-3xl font-extrabold text-foreground mb-2">Command Center</h1>
        <p className="text-sm text-muted-foreground mb-8">{authMode === "login" ? "Sign in to continue" : "Create your account"}</p>
        <div className="flex flex-col gap-3 px-5">
          <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Email address"
            className={cn("h-11", authErr && authErr !== "Check your email for a confirmation link!" && "border-loss")} />
          <Input type="password" value={pw} onChange={e => setPw(e.target.value)} onKeyDown={e => e.key === "Enter" && login()} placeholder="Password (min 6 chars)"
            className={cn("h-11", authErr && authErr !== "Check your email for a confirmation link!" && "border-loss")} />
          <Button onClick={login} disabled={authLoading} className="h-11 font-bold text-sm">
            {authLoading ? "..." : authMode === "login" ? "SIGN IN" : "SIGN UP"}
          </Button>
        </div>
        {authErr && <p className={cn("text-xs mt-3", authErr === "Check your email for a confirmation link!" ? "text-profit" : "text-loss")}>{authErr}</p>}
        <p className="mt-5 text-xs text-muted-foreground">
          {authMode === "login" ? "No account? " : "Already have one? "}
          <span onClick={() => { setAuthMode(authMode === "login" ? "signup" : "login"); setAuthErr(""); }}
            className="text-primary cursor-pointer underline underline-offset-2 hover:text-primary/80">
            {authMode === "login" ? "Sign up" : "Sign in"}
          </span>
        </p>
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
    { id: "coach", label: "AI Coach", icon: "✦" },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground text-sm">
      {/* Header */}
      <header className="border-b border-border px-5 py-3 flex justify-between items-center flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <span className="text-primary text-xs tracking-[3px] uppercase font-semibold">Steiner Trading Terminal</span>
          <span className="text-muted-foreground text-[10px]">v2.0</span>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {consLoss >= 3 && <span className="bg-loss-muted text-loss px-2.5 py-1 rounded-md text-[10px] font-bold animate-pulse">⚠ 3+ LOSSES — STOP TRADING</span>}
          {wkPnL < 0 && Math.abs(wkPnL) >= curCap * 0.03 && <span className="bg-loss-muted text-loss px-2.5 py-1 rounded-md text-[10px] font-bold">⚠ WEEKLY MAX LOSS</span>}
          <span className="text-muted-foreground text-xs">{new Date().toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}</span>
          <span className="text-muted-foreground/60 text-[10px]">{session.user.email}</span>
          <Button variant="outline" size="sm" onClick={logout} className="h-7 text-[10px] px-3">LOGOUT</Button>
        </div>
      </header>

      {/* Navigation */}
      <nav className="flex gap-1 px-4 py-2 border-b border-border overflow-x-auto flex-wrap">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} className={cn(
            "px-3.5 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap transition-all",
            tab === t.id
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground hover:bg-accent"
          )}>{t.icon} {t.label}</button>
        ))}
      </nav>

      {/* Content */}
      <main className="p-5 max-w-[1100px] mx-auto">
        {tab === "dashboard" && <Dashboard {...{ trades, settings, curCap, totalPnL, winRate, open, closed, maxRisk$: maxRisk$, wkPnL, consLoss }} />}
        {tab === "trades" && <Trades {...{ trades, addTrade, updateTrade, deleteTrade, settings, curCap }} />}
        {tab === "calc" && <Calc {...{ settings, setSettings, curCap }} />}
        {tab === "rules" && <Rules />}
        {tab === "watchlist" && <Watchlist {...{ watchlist, addWLItem, updateWLItem, deleteWLItem }} />}
        {tab === "risk" && <Risk {...{ trades, settings, curCap, closed, wkPnL, consLoss }} />}
        {tab === "coach" && <Coach portfolio={{
          capital: curCap, startCapital: settings.capital, totalPnL, winRate,
          openCount: open.length, maxPositions: settings.maxPositions,
          wkPnL, consLoss,
          openTrades: open.map(t => ({ ticker: t.ticker, shares: t.shares, entry: t.entry, stop: t.stop, target: t.target })),
          closedTrades: closed.slice(0, 20).map(t => ({
            ticker: t.ticker, type: t.type, setup: t.setup, pnl: t.pnl, rr: t.rr, closeDate: t.closeDate,
            followedRules: t.followedRules, emotion: t.emotion,
            lessons: t.journalLessons, mistakes: t.journalMistakes,
          })),
        }} />}
      </main>
      <Toast toasts={toasts} removeToast={removeToast} />
      {confirm && <ConfirmDialog message={confirm.message} onConfirm={confirm.onConfirm} onCancel={() => setConfirm(null)} />}
      <style>{`
        @keyframes pulse { 0%,100% { opacity:1 } 50% { opacity:.5 } }
        @keyframes toastIn { from { opacity:0; transform:translateX(20px); } to { opacity:1; transform:translateX(0); } }
      `}</style>
    </div>
  );
}
