import { useEffect, useMemo, useState, useCallback } from "react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine,
} from "recharts";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { tb, STOCK_SYMBOLS } from "@/lib/tradingBot";
import { C } from "../constants";
import { fmt, fUSD, fPct } from "../helpers";

// Stocks tick less frantically than crypto; 15s is plenty and easier
// on IB's per-account market-data limits.
const POLL_MS = 15_000;
const HISTORY_POLL_MS = 30_000;


export default function StocksBot({ toast }) {
  // ----- Mode + IB connection state -----
  const [mode, setMode] = useState(null);
  const [health, setHealth] = useState(null);
  const [healthError, setHealthError] = useState(null);

  // ----- Market data -----
  const [prices, setPrices] = useState({});
  const [pricesError, setPricesError] = useState(null);

  // ----- Account + positions -----
  const [account, setAccount] = useState(null);
  const [positions, setPositions] = useState([]);
  const [positionsTotals, setPositionsTotals] = useState({ unrealized_pnl_usd: 0, current_value_usd: 0 });

  // ----- Selected symbol / chart -----
  const [selected, setSelected] = useState("AAPL");
  const [granularity, setGranularity] = useState("1h");
  const [candles, setCandles] = useState([]);

  // ----- Analyze form -----
  const [thesis, setThesis] = useState("");
  const [stop, setStop] = useState("");
  const [target, setTarget] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [verdict, setVerdict] = useState(null);

  // ----- Scout state -----
  const [researching, setResearching] = useState(false);
  const [scout, setScout] = useState(null);
  const [scoutId, setScoutId] = useState(null);

  // ----- Recent activity (filtered to stocks) -----
  const [history, setHistory] = useState([]);
  const [acctState, setAcctState] = useState(null);

  // ----- Bootstrap -----
  useEffect(() => {
    let alive = true;
    tb.health()
      .then((h) => alive && (setHealth(h), setHealthError(null), setMode(h.mode)))
      .catch((e) => alive && setHealthError(e.message));
    return () => { alive = false; };
  }, []);

  const ibkrStatus = health?.brokers?.ibkr;
  const ibkrDisabled = ibkrStatus === "disabled";

  // ----- Polling (only when IB is enabled — otherwise pointless requests) -----
  const refreshPrices = useCallback(async () => {
    if (ibkrDisabled || healthError) return;
    try {
      const res = await tb.stockPrices(STOCK_SYMBOLS);
      const map = {};
      for (const p of res.prices) map[p.symbol] = p;
      setPrices(map);
      setPricesError(null);
    } catch (e) {
      setPricesError(e.message);
    }
  }, [ibkrDisabled, healthError]);

  useEffect(() => {
    refreshPrices();
    const id = setInterval(refreshPrices, POLL_MS);
    return () => clearInterval(id);
  }, [refreshPrices]);

  const refreshAccount = useCallback(async () => {
    if (ibkrDisabled || healthError) return;
    try { setAccount(await tb.stockAccount()); } catch {/* tolerated */}
  }, [ibkrDisabled, healthError]);

  useEffect(() => {
    refreshAccount();
    const id = setInterval(refreshAccount, POLL_MS);
    return () => clearInterval(id);
  }, [refreshAccount]);

  const refreshPositions = useCallback(async () => {
    if (ibkrDisabled || healthError) return;
    try {
      const res = await tb.stockPositions();
      setPositions(res.positions || []);
      setPositionsTotals(res.totals || { unrealized_pnl_usd: 0, current_value_usd: 0 });
    } catch {/* tolerated */}
  }, [ibkrDisabled, healthError]);

  useEffect(() => {
    refreshPositions();
    const id = setInterval(refreshPositions, POLL_MS);
    return () => clearInterval(id);
  }, [refreshPositions]);

  useEffect(() => {
    if (ibkrDisabled || healthError) return;
    let alive = true;
    tb.stockCandles(selected, granularity)
      .then((res) => alive && setCandles(res.candles || []))
      .catch(() => alive && setCandles([]));
    return () => { alive = false; };
  }, [selected, granularity, ibkrDisabled, healthError]);

  const refreshHistory = useCallback(async () => {
    if (healthError) return;
    try {
      // Pull recent trade events; filter to stock rows client-side.
      // (We could push the asset_type filter to the bot, but the
      // /trading/history endpoint doesn't take it yet — quick TODO.)
      const res = await tb.history(50);
      setHistory((res.trades || []).filter((t) => (t.asset_type || "crypto") === "stock"));
    } catch {/* tolerated */}
  }, [healthError]);

  useEffect(() => {
    refreshHistory();
    const id = setInterval(refreshHistory, HISTORY_POLL_MS);
    return () => clearInterval(id);
  }, [refreshHistory]);

  const refreshAcctState = useCallback(async () => {
    if (healthError) return;
    try { setAcctState(await tb.accountState()); } catch {/* tolerated */}
  }, [healthError]);

  useEffect(() => {
    refreshAcctState();
    const id = setInterval(refreshAcctState, HISTORY_POLL_MS);
    return () => clearInterval(id);
  }, [refreshAcctState]);

  // ----- Derived -----
  const selectedPrice = prices[selected]?.price;
  const isPaper = mode === "paper";
  const usdAvailable = useMemo(() => {
    const v = account?.summary?.BuyingPower?.value ?? account?.summary?.TotalCashValue?.value;
    return typeof v === "number" ? v : 0;
  }, [account]);

  // ----- Actions -----
  const runResearch = async () => {
    setResearching(true);
    setScout(null);
    setVerdict(null);
    try {
      const a = await tb.accountState().catch(() => acctState);
      const plan = await tb.stockResearch({
        symbol: selected,
        side: "BUY",
        account_balance: a?.account_balance ?? usdAvailable ?? undefined,
      });
      setScout(plan);
      setScoutId(plan.scout_id ?? null);
      setStop(String(plan.suggested_stop ?? ""));
      setTarget(String(plan.suggested_target ?? ""));
      setThesis(plan.thesis ?? "");
      toast?.(`Scout proposed ${selected} setup — R:R ${plan.rr_ratio?.toFixed(2)}:1, conf ${(plan.confidence * 100).toFixed(0)}%`);
    } catch (e) {
      toast?.(`Research failed: ${e.message}`, "error");
    } finally {
      setResearching(false);
    }
  };

  const runAnalyze = async () => {
    if (!thesis.trim()) return toast?.("Thesis required", "error");
    if (!stop || !target) return toast?.("Stop and target required", "error");
    setAnalyzing(true);
    setVerdict(null);
    try {
      const a = await tb.accountState().catch(() => acctState);
      const v = await tb.analyze({
        product_id: selected,
        current_price: Number(selectedPrice),
        proposed_entry: Number(selectedPrice),
        stop_price: Number(stop),
        target_price: Number(target),
        account_balance: a?.account_balance ?? usdAvailable ?? 10000,
        open_positions: a?.open_positions ?? 0,
        consecutive_losses: a?.consecutive_losses ?? 0,
        weekly_pnl: a?.weekly_pnl ?? 0,
        thesis: thesis.trim(),
        side: "BUY",
        market_type: "stocks",       // <-- stocks rule set + stocks brain prompt
        scout_id: scoutId,
      });
      setVerdict(v);
    } catch (e) {
      toast?.(`Analyze failed: ${e.message}`, "error");
    } finally {
      setAnalyzing(false);
    }
  };

  const placeOrderFromVerdict = async () => {
    if (!verdict) return;
    if (verdict.decision !== "BUY" && verdict.decision !== "SELL") {
      return toast?.(`Cannot trade — Claude verdict was ${verdict.decision}`, "error");
    }
    const sizeUsd = Number(verdict.suggested_size_usd ?? 0);
    if (!sizeUsd || sizeUsd <= 0) {
      return toast?.("No size suggested in verdict", "error");
    }
    if (!selectedPrice) {
      return toast?.("No live price for this symbol — cannot size", "error");
    }
    // Convert USD-sized recommendation into share count for an IB order.
    // Floor to whole shares (most stocks don't accept fractional via IB
    // unless explicitly enabled).
    const shares = Math.floor(sizeUsd / Number(selectedPrice));
    if (shares <= 0) {
      return toast?.(
        `Suggested size $${sizeUsd.toFixed(2)} is below 1 share at $${Number(selectedPrice).toFixed(2)} — increase capital or pick a cheaper symbol`,
        "error",
      );
    }
    try {
      const res = await tb.placeStockOrder({
        symbol: selected,
        side: verdict.decision,
        order_type: "MARKET",
        quantity: shares,
      });
      toast?.(`${res.mode} ${res.side} ${shares} ${selected} @ ${fUSD(res.fill_price)}`);
      setVerdict(null);
      setScout(null);
      setScoutId(null);
      setThesis(""); setStop(""); setTarget("");
      refreshAccount();
      refreshPositions();
      refreshHistory();
      refreshAcctState();
    } catch (e) {
      toast?.(`Order rejected: ${e.message}`, "error");
    }
  };

  // ===== Render =====

  // IB-disabled banner: the most common reason all stock requests fail
  // is that IBKR_ENABLED=false. Show ONE clear card instead of letting
  // every panel error individually.
  if (ibkrDisabled) {
    return (
      <div>
        <div className="flex items-center justify-between mb-1 flex-wrap gap-2">
          <h1 className="text-2xl font-bold">Stocks Bot</h1>
          <Badge variant="secondary" className="text-[10px] tracking-widest font-bold">IBKR DISABLED</Badge>
        </div>
        <p className="text-muted-foreground text-xs mb-6">
          Interactive Brokers integration via TWS/Gateway. Same Claude AI flow as the crypto bot:
          🔍 RESEARCH → ✦ ANALYZE → ✓ EXECUTE.
        </p>
        <Card>
          <CardContent className="p-5 text-sm">
            <div className="font-semibold mb-2">To enable:</div>
            <ol className="list-decimal pl-5 space-y-1 text-xs">
              <li>Start TWS or IB Gateway with API access enabled (Configure → API → Settings → "Enable ActiveX and Socket Clients").</li>
              <li>In Coolify (production) or your local <code>.env</code>, set <code>IBKR_ENABLED=true</code>.</li>
              <li>Verify the host/port match (default for WSL2 dev: <code>172.30.192.1:7497</code> for TWS paper).</li>
              <li>Refresh this page. The first request will trigger the lazy connect.</li>
            </ol>
          </CardContent>
        </Card>
      </div>
    );
  }

  const headerError = healthError ? (
    <Card className="mb-4 border-loss">
      <CardContent className="p-4 text-xs text-loss">
        Trading-bot API unreachable. Error: {healthError}
      </CardContent>
    </Card>
  ) : null;

  return (
    <div>
      <div className="flex items-center justify-between mb-1 flex-wrap gap-2">
        <h1 className="text-2xl font-bold">Stocks Bot</h1>
        <div className="flex items-center gap-2">
          <Badge variant={isPaper ? "secondary" : "destructive"} className="text-[10px] tracking-widest font-bold">
            {mode ? mode.toUpperCase() : "LOADING"}
          </Badge>
          <Badge variant={ibkrStatus === "connected" ? "default" : "outline"} className="text-[10px]">
            IBKR: {ibkrStatus || "?"}
          </Badge>
          {health && <Badge variant="outline" className="text-[10px]">v{health.version}</Badge>}
        </div>
      </div>
      <p className="text-muted-foreground text-xs mb-6">
        IBKR + Claude trading brain. {isPaper ? "Paper mode — bot's own ledger, no real shares." : "LIVE — real funds at risk."}
      </p>

      {headerError}

      {/* Open Positions */}
      <Card className="mb-6">
        <CardContent className="p-5">
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <div className="text-xs text-muted-foreground tracking-wider uppercase">◎ Open Positions</div>
            <div className="flex items-center gap-3 text-xs">
              <span className="text-muted-foreground">Deployed: <span className="text-foreground font-semibold">{fUSD(positionsTotals.current_value_usd)}</span></span>
              <span className="text-muted-foreground">Unrealized:
                <span className={cn("font-bold ml-1", positionsTotals.unrealized_pnl_usd > 0 ? "text-profit" : positionsTotals.unrealized_pnl_usd < 0 ? "text-loss" : "text-foreground")}>
                  {fUSD(positionsTotals.unrealized_pnl_usd)}
                </span>
              </span>
            </div>
          </div>
          {positions.length === 0 ? (
            <div className="text-xs text-muted-foreground">No open stock positions.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-muted-foreground border-b border-border">
                    <th className="text-left py-1.5 pr-3">Symbol</th>
                    <th className="text-right py-1.5 pr-3">Shares</th>
                    <th className="text-right py-1.5 pr-3">Avg Cost</th>
                    <th className="text-right py-1.5 pr-3">Current</th>
                    <th className="text-right py-1.5 pr-3">Cost Basis</th>
                    <th className="text-right py-1.5 pr-3">Value</th>
                    <th className="text-right py-1.5 pr-3">Unrealized P&L</th>
                    <th className="text-right py-1.5 pr-3">%</th>
                    <th className="text-left py-1.5 pl-2">Opened</th>
                  </tr>
                </thead>
                <tbody>
                  {positions.map((p) => {
                    const pnl = p.unrealized_pnl_usd;
                    const pct = p.unrealized_pnl_pct;
                    const pnlColor = pnl > 0 ? "text-profit" : pnl < 0 ? "text-loss" : "text-foreground";
                    return (
                      <tr key={p.symbol} onClick={() => setSelected(p.symbol)}
                          className={cn(
                            "border-b border-border last:border-0 cursor-pointer transition-colors hover:bg-accent/40",
                            selected === p.symbol && "bg-primary/5",
                          )}>
                        <td className="py-2 pr-3 font-bold">{p.symbol}</td>
                        <td className="py-2 pr-3 text-right">{fmt(p.quantity, 4)}</td>
                        <td className="py-2 pr-3 text-right">{p.avg_cost != null ? fUSD(p.avg_cost) : "—"}</td>
                        <td className="py-2 pr-3 text-right">{p.current_price != null ? fUSD(p.current_price) : "—"}</td>
                        <td className="py-2 pr-3 text-right text-muted-foreground">{p.cost_basis_usd != null ? fUSD(p.cost_basis_usd) : "—"}</td>
                        <td className="py-2 pr-3 text-right">{p.current_value_usd != null ? fUSD(p.current_value_usd) : "—"}</td>
                        <td className={cn("py-2 pr-3 text-right font-bold", pnlColor)}>{pnl != null ? fUSD(pnl) : "—"}</td>
                        <td className={cn("py-2 pr-3 text-right", pnlColor)}>{pct != null ? `${pct >= 0 ? "+" : ""}${fmt(pct, 2)}%` : "—"}</td>
                        <td className="py-2 pl-2 text-muted-foreground">
                          {p.open_since
                            ? new Date(p.open_since).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
                            : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <div className="text-[10px] text-muted-foreground mt-2 italic">
                Click a row to load that symbol into the chart and analyze form.
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Live prices */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <div className="text-xs text-muted-foreground tracking-wider uppercase">◈ Live Prices</div>
            {pricesError && <div className="text-[10px] text-loss">{pricesError}</div>}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
            {STOCK_SYMBOLS.map((sym) => {
              const p = prices[sym];
              const isSel = selected === sym;
              return (
                <button key={sym} onClick={() => setSelected(sym)}
                  className={cn(
                    "text-left p-3 rounded-md border transition-colors",
                    isSel ? "border-primary bg-primary/10" : "border-border hover:border-muted-foreground/40",
                  )}>
                  <div className="text-[10px] text-muted-foreground tracking-wide">{sym}</div>
                  <div className="text-sm font-bold mt-1">{p?.price ? fUSD(p.price) : "—"}</div>
                  {p?.delayed && <div className="text-[10px] text-amber mt-0.5">delayed</div>}
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Account + Candle chart */}
      <div className="flex gap-3 flex-wrap mb-6">
        <Card className="flex-1 min-w-[260px]">
          <CardContent className="p-5">
            <div className="text-xs text-muted-foreground tracking-wider uppercase mb-3">◉ {isPaper ? "Paper" : "Live"} Account</div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="text-[10px] text-muted-foreground">Buying Power (USD)</div>
                <div className="text-lg font-bold">{fUSD(usdAvailable)}</div>
              </div>
              {account?.account && (
                <div>
                  <div className="text-[10px] text-muted-foreground">Account</div>
                  <div className="text-sm font-semibold">{account.account}</div>
                </div>
              )}
              {account?.summary?.NetLiquidation?.value != null && (
                <div>
                  <div className="text-[10px] text-muted-foreground">Net Liquidation</div>
                  <div className="text-sm font-semibold">{fUSD(account.summary.NetLiquidation.value)}</div>
                </div>
              )}
              {account?.summary?.DayTradesRemaining?.value != null && (
                <div>
                  <div className="text-[10px] text-muted-foreground">Day Trades Remaining</div>
                  <div className="text-sm font-semibold">{account.summary.DayTradesRemaining.value}</div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="flex-[2] min-w-[400px]">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
              <div className="text-xs text-muted-foreground tracking-wider uppercase">◈ {selected} {granularity}</div>
              <div className="flex gap-1">
                {["5m", "15m", "1h", "1d"].map((g) => (
                  <button key={g} onClick={() => setGranularity(g)}
                    className={cn(
                      "px-2 py-0.5 rounded text-[10px] font-semibold",
                      granularity === g ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
                    )}>
                    {g}
                  </button>
                ))}
              </div>
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={candles.map((c) => ({ ...c, ts: c.start }))}>
                <defs>
                  <linearGradient id="sgrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={C.chartGreen} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={C.chartGreen} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={C.chartBorder} />
                <XAxis dataKey="ts" tick={{ fill: C.chartText, fontSize: 10 }} stroke={C.chartBorder}
                  tickFormatter={(v) => v ? new Date(v * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : ""} />
                <YAxis tick={{ fill: C.chartText, fontSize: 10 }} stroke={C.chartBorder}
                  domain={["auto", "auto"]} tickFormatter={(v) => `$${v.toLocaleString()}`} />
                <Tooltip
                  contentStyle={{ backgroundColor: C.chartBg, border: `1px solid ${C.chartBorder}`, borderRadius: 8, fontSize: 12 }}
                  labelFormatter={(v) => new Date(v * 1000).toLocaleString()}
                  formatter={(v) => [fUSD(v), "Close"]} />
                {selectedPrice && (
                  <ReferenceLine y={selectedPrice} stroke={C.chartCyan} strokeDasharray="3 3"
                    label={{ value: fUSD(selectedPrice), fill: C.chartCyan, fontSize: 10 }} />
                )}
                <Area type="monotone" dataKey="close" stroke={C.chartGreen} fill="url(#sgrad)" strokeWidth={2} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Analyze form */}
      <Card className="mb-6">
        <CardContent className="p-5">
          <div className="text-xs text-muted-foreground tracking-wider uppercase mb-4">✦ Analyze {selected} via Claude</div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
            <div>
              <div className="text-[10px] text-muted-foreground mb-1">Current price</div>
              <div className="text-base font-bold">{fUSD(selectedPrice)}</div>
            </div>
            <div>
              <div className="text-[10px] text-muted-foreground mb-1">Stop price</div>
              <Input type="number" value={stop} onChange={(e) => setStop(e.target.value)} placeholder="e.g. 175.00" className="h-9 text-sm" />
            </div>
            <div>
              <div className="text-[10px] text-muted-foreground mb-1">Target price</div>
              <Input type="number" value={target} onChange={(e) => setTarget(e.target.value)} placeholder="e.g. 195.00" className="h-9 text-sm" />
            </div>
            <div>
              <div className="text-[10px] text-muted-foreground mb-1">R:R</div>
              <div className="text-base font-bold h-9 flex items-center">
                {selectedPrice && stop && target && Number(selectedPrice) > Number(stop)
                  ? `${fmt((Number(target) - Number(selectedPrice)) / (Number(selectedPrice) - Number(stop)), 2)}:1`
                  : "—"}
              </div>
            </div>
          </div>
          <div className="mb-3">
            <div className="text-[10px] text-muted-foreground mb-1">Thesis (E6 — at least 10 substantive words; 50-day MA / volume / trigger / SPY-QQQ context)</div>
            <textarea
              value={thesis} onChange={(e) => setThesis(e.target.value)} rows={3}
              placeholder="e.g. AAPL above 50-day MA, breakout above $185 resistance with above-avg volume on the daily, retested as support. SPY trending up. Stop below the 50-day at $175, target prior swing high $195 for 2:1 R:R."
              className="w-full bg-background border border-border rounded-md p-3 text-sm focus:border-primary outline-none" />
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button onClick={runResearch} disabled={researching || !!healthError} variant="outline" className="text-xs font-bold">
              {researching ? "RESEARCHING..." : "🔍 RESEARCH (auto-fill)"}
            </Button>
            <Button onClick={runAnalyze} disabled={analyzing || !!healthError} className="text-xs font-bold">
              {analyzing ? "ANALYZING..." : "✦ ANALYZE (rule check)"}
            </Button>
            {verdict && (
              <Button onClick={placeOrderFromVerdict}
                disabled={verdict.decision !== "BUY" && verdict.decision !== "SELL"}
                variant="default" className="text-xs font-bold">
                {verdict.decision === "BUY" || verdict.decision === "SELL"
                  ? `✓ EXECUTE ${verdict.decision} (${fUSD(verdict.suggested_size_usd || 0)})`
                  : `BLOCKED — ${verdict.decision}`}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {scout && <Scout scout={scout} />}
      {verdict && <Verdict verdict={verdict} />}

      {/* Recent activity */}
      <Card className="mb-6">
        <CardContent className="p-5">
          <div className="text-xs text-muted-foreground tracking-wider uppercase mb-4">◎ Recent Stock Activity</div>
          {history.length === 0 ? (
            <div className="text-xs text-muted-foreground">No stock activity yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-muted-foreground border-b border-border">
                    <th className="text-left py-1.5 pr-3">Time</th>
                    <th className="text-left py-1.5 pr-3">Action</th>
                    <th className="text-left py-1.5 pr-3">Symbol</th>
                    <th className="text-left py-1.5 pr-3">Side</th>
                    <th className="text-right py-1.5 pr-3">Shares</th>
                    <th className="text-right py-1.5 pr-3">Price</th>
                    <th className="text-right py-1.5 pr-3">Realized P&L</th>
                    <th className="text-left py-1.5">Status / Error</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((t) => (
                    <tr key={t.id} className="border-b border-border last:border-0">
                      <td className="py-1.5 pr-3 text-muted-foreground">{new Date(t.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</td>
                      <td className="py-1.5 pr-3">{t.action}</td>
                      <td className="py-1.5 pr-3 font-semibold">{t.product_id || "—"}</td>
                      <td className="py-1.5 pr-3">{t.side || "—"}</td>
                      <td className="py-1.5 pr-3 text-right">{t.size ? fmt(Number(t.size), 4) : "—"}</td>
                      <td className="py-1.5 pr-3 text-right">{t.price ? fUSD(Number(t.price)) : "—"}</td>
                      <td className={cn("py-1.5 pr-3 text-right", Number(t.realized_pnl) > 0 ? "text-profit" : Number(t.realized_pnl) < 0 ? "text-loss" : "text-muted-foreground")}>
                        {t.realized_pnl != null ? fUSD(Number(t.realized_pnl)) : "—"}
                      </td>
                      <td className={cn("py-1.5", t.status === "blocked" || t.action === "error" ? "text-loss" : "text-foreground")}>
                        {t.error_message || t.status || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}


function Scout({ scout }) {
  return (
    <Card className="mb-6">
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <div className="text-xs text-muted-foreground tracking-wider uppercase">🔍 Scout proposal</div>
          <div className="flex items-center gap-2">
            <span className="text-xs">R:R</span>
            <span className="text-base font-bold">{scout.rr_ratio ? `${scout.rr_ratio.toFixed(2)}:1` : "—"}</span>
            <span className="text-xs text-muted-foreground ml-2">conf {(scout.confidence * 100).toFixed(0)}%</span>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4 text-xs">
          <div><div className="text-muted-foreground">Entry</div><div className="font-bold text-base">{fUSD(scout.suggested_entry)}</div></div>
          <div><div className="text-muted-foreground">Stop</div><div className="font-bold text-base text-loss">{fUSD(scout.suggested_stop)}</div></div>
          <div><div className="text-muted-foreground">Target</div><div className="font-bold text-base text-profit">{fUSD(scout.suggested_target)}</div></div>
          <div><div className="text-muted-foreground">Suggested size (1% risk)</div><div className="font-bold text-base">{scout.suggested_size_usd ? fUSD(scout.suggested_size_usd) : "—"}</div></div>
        </div>

        <div className="text-[10px] tracking-wider uppercase text-muted-foreground mb-1">Thesis</div>
        <p className="text-sm mb-3">{scout.thesis}</p>

        {scout.key_levels && Object.keys(scout.key_levels).length > 0 && (
          <div className="mb-3">
            <div className="text-[10px] tracking-wider uppercase text-muted-foreground mb-1">Key levels</div>
            <div className="flex flex-wrap gap-2">
              {Object.entries(scout.key_levels).map(([k, v]) => (
                <span key={k} className="text-[11px] bg-accent text-accent-foreground px-2 py-0.5 rounded">{k}: {fUSD(v)}</span>
              ))}
            </div>
          </div>
        )}

        {scout.market_context && Object.keys(scout.market_context).length > 0 && (
          <div className="mb-3">
            <div className="text-[10px] tracking-wider uppercase text-muted-foreground mb-1">Market context (E5)</div>
            <div className="flex flex-wrap gap-2">
              {Object.entries(scout.market_context).map(([k, v]) => (
                <span key={k} className="text-[11px] bg-accent text-accent-foreground px-2 py-0.5 rounded">
                  {k}: {v?.price ? fUSD(v.price) : (v?.error || "?")}
                </span>
              ))}
            </div>
          </div>
        )}

        {scout.warnings && scout.warnings.length > 0 && (
          <div className="mb-2">
            <div className="text-[10px] tracking-wider uppercase text-amber mb-1">Caveats</div>
            <ul className="text-xs text-amber list-disc pl-5 space-y-0.5">
              {scout.warnings.map((w, i) => <li key={i}>{w}</li>)}
            </ul>
          </div>
        )}

        <p className="text-[11px] text-muted-foreground italic">
          Stop / target / thesis fields above are pre-filled from this proposal. Tweak them if you disagree, then click <strong>✦ ANALYZE</strong> to run the rule check.
        </p>
      </CardContent>
    </Card>
  );
}


function Verdict({ verdict }) {
  const decisionColor = {
    BUY: "text-profit", SELL: "text-info", HOLD: "text-amber", REJECT: "text-loss",
  }[verdict.decision] || "text-foreground";

  return (
    <Card className="mb-6">
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <div className="text-xs text-muted-foreground tracking-wider uppercase">✦ Claude Verdict</div>
          <div className="flex items-center gap-2">
            <span className={cn("text-xl font-extrabold", decisionColor)}>{verdict.decision}</span>
            <span className="text-xs text-muted-foreground">conf {fPct(verdict.confidence * 100)}</span>
          </div>
        </div>
        <p className="text-sm mb-3">{verdict.reasoning}</p>
        {verdict.suggested_size_usd != null && (
          <div className="flex gap-4 text-xs mb-3 flex-wrap">
            <div><span className="text-muted-foreground">Suggested size: </span><span className="font-bold">{fUSD(verdict.suggested_size_usd)}</span></div>
            {verdict.suggested_size_crypto != null && (
              <div><span className="text-muted-foreground">In shares: </span><span className="font-bold">{fmt(verdict.suggested_size_crypto, 4)}</span></div>
            )}
          </div>
        )}
        {verdict.warnings && verdict.warnings.length > 0 && (
          <div className="mb-3">
            <div className="text-[10px] text-amber tracking-wider uppercase mb-1">Warnings</div>
            <ul className="text-xs text-amber list-disc pl-5">
              {verdict.warnings.map((w, i) => <li key={i}>{w}</li>)}
            </ul>
          </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1">
          {Object.entries(verdict.rule_check || {}).map(([id, r]) => {
            const color = r.status === "PASS" ? "text-profit" : r.status === "FAIL" ? "text-loss" : r.status === "WARN" ? "text-amber" : "text-muted-foreground";
            const mark = r.status === "PASS" ? "✓" : r.status === "FAIL" ? "✗" : r.status === "WARN" ? "⚠" : "·";
            return (
              <div key={id} className="text-[11px] flex gap-2">
                <span className={cn("font-bold w-6", color)}>{mark} {id}</span>
                <span className="text-muted-foreground flex-1">{r.detail}</span>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
