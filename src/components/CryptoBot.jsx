import { useEffect, useMemo, useState, useCallback } from "react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine,
} from "recharts";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { tb, PRODUCTS } from "@/lib/tradingBot";
import { C } from "../constants";
import { fmt, fUSD, fPct } from "../helpers";

// Polling interval for live prices and balances. 10s is conservative —
// we don't want to hammer Coinbase or burn Supabase reads while the tab
// is open in the background.
const POLL_MS = 10_000;

// Auto-refresh history less often; it changes only when an order is
// placed/blocked, which the user triggers explicitly.
const HISTORY_POLL_MS = 30_000;


export default function CryptoBot({ toast }) {
  // ----- Mode + health -----
  const [mode, setMode] = useState(null);
  const [health, setHealth] = useState(null);
  const [healthError, setHealthError] = useState(null);

  // ----- Market data -----
  const [prices, setPrices] = useState({});           // { "BTC-USD": {price, bid, ask, volume_24h}, ... }
  const [pricesError, setPricesError] = useState(null);

  // ----- Balances -----
  const [balances, setBalances] = useState([]);

  // ----- Selected product / chart -----
  const [selected, setSelected] = useState("BTC-USD");
  const [granularity, setGranularity] = useState("1h");
  const [candles, setCandles] = useState([]);

  // ----- Analyze form -----
  const [thesis, setThesis] = useState("");
  const [stop, setStop] = useState("");
  const [target, setTarget] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [verdict, setVerdict] = useState(null);

  // ----- Scout (research) state -----
  const [researching, setResearching] = useState(false);
  const [scout, setScout] = useState(null);  // last research result for context

  // ----- Trade history -----
  const [history, setHistory] = useState([]);

  // ----- Aggregate account state for analyze (consecutive_losses, weekly_pnl, etc.) -----
  const [acctState, setAcctState] = useState(null);

  // ----- Initial bootstrap + health probe -----
  useEffect(() => {
    let alive = true;
    tb.health()
      .then((h) => alive && (setHealth(h), setHealthError(null)))
      .catch((e) => alive && setHealthError(e.message));
    tb.mode().then((m) => alive && setMode(m.mode)).catch(() => {});
    return () => { alive = false; };
  }, []);

  // ----- Price polling -----
  const refreshPrices = useCallback(async () => {
    try {
      const res = await tb.prices(PRODUCTS);
      const map = {};
      for (const p of res.prices) map[p.product_id] = p;
      setPrices(map);
      setPricesError(null);
    } catch (e) {
      setPricesError(e.message);
    }
  }, []);

  useEffect(() => {
    refreshPrices();
    const id = setInterval(refreshPrices, POLL_MS);
    return () => clearInterval(id);
  }, [refreshPrices]);

  // ----- Balance polling (only attempts when health is OK) -----
  const refreshBalances = useCallback(async () => {
    if (healthError) return;
    try {
      const res = await tb.balances();
      setBalances(res.balances || []);
    } catch {
      // Ignore — usually means Supabase not configured. Other panels
      // surface that more clearly.
    }
  }, [healthError]);

  useEffect(() => {
    refreshBalances();
    const id = setInterval(refreshBalances, POLL_MS);
    return () => clearInterval(id);
  }, [refreshBalances]);

  // ----- Candles refresh on product/granularity change -----
  useEffect(() => {
    let alive = true;
    tb.candles(selected, granularity, 100)
      .then((res) => alive && setCandles(res.candles || []))
      .catch(() => alive && setCandles([]));
    return () => { alive = false; };
  }, [selected, granularity]);

  // ----- History polling -----
  const refreshHistory = useCallback(async () => {
    if (healthError) return;
    try {
      const res = await tb.history(20);
      setHistory(res.trades || []);
    } catch {/* see balances */}
  }, [healthError]);

  useEffect(() => {
    refreshHistory();
    const id = setInterval(refreshHistory, HISTORY_POLL_MS);
    return () => clearInterval(id);
  }, [refreshHistory]);

  // ----- Account state polling (used by analyze form) -----
  const refreshAcctState = useCallback(async () => {
    if (healthError) return;
    try { setAcctState(await tb.accountState()); }
    catch {/* tolerated — analyze form will fall back to balances */}
  }, [healthError]);

  useEffect(() => {
    refreshAcctState();
    const id = setInterval(refreshAcctState, HISTORY_POLL_MS);
    return () => clearInterval(id);
  }, [refreshAcctState]);

  // ----- Derived -----
  const usdBalance = useMemo(
    () => Number(balances.find((b) => b.currency === "USD")?.available ?? 0),
    [balances],
  );
  const cryptoBalances = useMemo(
    () => balances.filter((b) => b.currency !== "USD"),
    [balances],
  );
  const selectedPrice = prices[selected]?.price;
  const isPaper = mode === "paper";

  // ----- Actions -----
  const runResearch = async () => {
    setResearching(true);
    setScout(null);
    setVerdict(null);
    try {
      const a = await tb.accountState().catch(() => acctState);
      const plan = await tb.research({
        product_id: selected,
        side: "BUY",
        market_type: "crypto",
        account_balance: a?.account_balance ?? usdBalance ?? undefined,
      });
      setScout(plan);
      // Auto-fill the analyze form so the user can either run analyze
      // immediately or tweak the levels first.
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
      // Pull the freshest account state right before analyze so a paper
      // trade that just closed shows up in consecutive_losses immediately
      // (rather than waiting for the 30s poll).
      const a = await tb.accountState().catch(() => acctState);
      const v = await tb.analyze({
        product_id: selected,
        current_price: Number(selectedPrice),
        proposed_entry: Number(selectedPrice),
        stop_price: Number(stop),
        target_price: Number(target),
        account_balance: a?.account_balance ?? usdBalance ?? 10000,
        open_positions: a?.open_positions ?? cryptoBalances.filter((b) => Number(b.available) > 0).length,
        consecutive_losses: a?.consecutive_losses ?? 0,
        weekly_pnl: a?.weekly_pnl ?? 0,
        thesis: thesis.trim(),
        side: "BUY",
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
    try {
      const res = await tb.placeOrder({
        product_id: selected,
        side: verdict.decision,
        order_type: "MARKET",
        quote_size: verdict.decision === "BUY" ? sizeUsd : undefined,
        // For SELL the brain returns suggested_size_crypto; if missing we
        // can't safely place a sell, so we refuse rather than guessing.
        base_size: verdict.decision === "SELL" ? Number(verdict.suggested_size_crypto) : undefined,
      });
      toast?.(`${res.mode} ${res.side} ${selected} @ ${fUSD(res.fill_price)}`);
      setVerdict(null);
      setThesis(""); setStop(""); setTarget("");
      refreshBalances();
      refreshHistory();
      refreshAcctState();
    } catch (e) {
      toast?.(`Order rejected: ${e.message}`, "error");
    }
  };

  // ===== Render =====

  const headerError = healthError ? (
    <Card className="mb-4 border-loss">
      <CardContent className="p-4 text-xs text-loss">
        Trading-bot API unreachable at <code>{import.meta.env.VITE_TRADING_BOT_URL || "http://localhost:8765"}</code>.
        Start it with <code>uvicorn app.main:app --port 8765</code> in <code>~/projects/trading-bot/api</code>.
        <br />Error: {healthError}
      </CardContent>
    </Card>
  ) : null;

  return (
    <div>
      <div className="flex items-center justify-between mb-1 flex-wrap gap-2">
        <h1 className="text-2xl font-bold">Crypto Bot</h1>
        <div className="flex items-center gap-2">
          <Badge variant={isPaper ? "secondary" : "destructive"} className="text-[10px] tracking-widest font-bold">
            {mode ? mode.toUpperCase() : "LOADING"}
          </Badge>
          {health && <Badge variant="outline" className="text-[10px]">v{health.version}</Badge>}
        </div>
      </div>
      <p className="text-muted-foreground text-xs mb-6">
        Coinbase Advanced Trade + Claude trading brain. {isPaper ? "Paper mode — no real money." : "LIVE — real funds at risk."}
      </p>

      {headerError}

      {/* Live prices */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <div className="text-xs text-muted-foreground tracking-wider uppercase">◈ Live Prices</div>
            {pricesError && <div className="text-[10px] text-loss">{pricesError}</div>}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
            {PRODUCTS.map((pid) => {
              const p = prices[pid];
              const isSel = selected === pid;
              return (
                <button
                  key={pid}
                  onClick={() => setSelected(pid)}
                  className={cn(
                    "text-left p-3 rounded-md border transition-colors",
                    isSel ? "border-primary bg-primary/10" : "border-border hover:border-muted-foreground/40",
                  )}
                >
                  <div className="text-[10px] text-muted-foreground tracking-wide">{pid}</div>
                  <div className="text-sm font-bold mt-1">{p ? fUSD(p.price) : "—"}</div>
                  {p && p.bid && p.ask && (
                    <div className="text-[10px] text-muted-foreground mt-0.5">
                      spread {fmt(p.ask - p.bid, 4)}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Balances */}
      <div className="flex gap-3 flex-wrap mb-6">
        <Card className="flex-1 min-w-[260px]">
          <CardContent className="p-5">
            <div className="text-xs text-muted-foreground tracking-wider uppercase mb-3">◉ {isPaper ? "Paper" : "Live"} Balances</div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <div className="text-[10px] text-muted-foreground">USD</div>
                <div className="text-lg font-bold">{fUSD(usdBalance)}</div>
              </div>
              {cryptoBalances.map((b) => (
                <div key={b.currency}>
                  <div className="text-[10px] text-muted-foreground">{b.currency}</div>
                  <div className="text-sm font-semibold">{fmt(Number(b.available), 8)}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Candle chart */}
        <Card className="flex-[2] min-w-[400px]">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
              <div className="text-xs text-muted-foreground tracking-wider uppercase">◈ {selected} {granularity}</div>
              <div className="flex gap-1">
                {["5m", "15m", "1h", "6h", "1d"].map((g) => (
                  <button
                    key={g}
                    onClick={() => setGranularity(g)}
                    className={cn(
                      "px-2 py-0.5 rounded text-[10px] font-semibold",
                      granularity === g ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {g}
                  </button>
                ))}
              </div>
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={candles.map((c) => ({ ...c, ts: c.start }))}>
                <defs>
                  <linearGradient id="cgrad" x1="0" y1="0" x2="0" y2="1">
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
                  formatter={(v) => [fUSD(v), "Close"]}
                />
                {selectedPrice && (
                  <ReferenceLine y={selectedPrice} stroke={C.chartCyan} strokeDasharray="3 3"
                    label={{ value: fUSD(selectedPrice), fill: C.chartCyan, fontSize: 10 }} />
                )}
                <Area type="monotone" dataKey="close" stroke={C.chartGreen} fill="url(#cgrad)" strokeWidth={2} dot={false} />
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
              <Input type="number" value={stop} onChange={(e) => setStop(e.target.value)} placeholder="e.g. 75000" className="h-9 text-sm" />
            </div>
            <div>
              <div className="text-[10px] text-muted-foreground mb-1">Target price</div>
              <Input type="number" value={target} onChange={(e) => setTarget(e.target.value)} placeholder="e.g. 79620" className="h-9 text-sm" />
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
            <div className="text-[10px] text-muted-foreground mb-1">Thesis (required by E6 — at least 10 substantive words)</div>
            <textarea
              value={thesis}
              onChange={(e) => setThesis(e.target.value)}
              rows={3}
              placeholder="e.g. BTC bouncing off 21 EMA on 4H with rising volume. Broke daily resistance at 76000 and retested as support. BTC market trend up. Stop below EMA, target prior swing high for 2.3:1 R:R."
              className="w-full bg-background border border-border rounded-md p-3 text-sm focus:border-primary outline-none"
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button onClick={runResearch} disabled={researching || !!healthError} variant="outline" className="text-xs font-bold">
              {researching ? "RESEARCHING..." : "🔍 RESEARCH (auto-fill)"}
            </Button>
            <Button onClick={runAnalyze} disabled={analyzing || !!healthError} className="text-xs font-bold">
              {analyzing ? "ANALYZING..." : "✦ ANALYZE (rule check)"}
            </Button>
            {verdict && (
              <Button
                onClick={placeOrderFromVerdict}
                disabled={verdict.decision !== "BUY" && verdict.decision !== "SELL"}
                variant="default"
                className="text-xs font-bold"
              >
                {verdict.decision === "BUY" || verdict.decision === "SELL"
                  ? `✓ EXECUTE ${verdict.decision} (${fUSD(verdict.suggested_size_usd || 0)})`
                  : `BLOCKED — ${verdict.decision}`}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Scout card (research) */}
      {scout && <Scout scout={scout} />}

      {/* Verdict card */}
      {verdict && <Verdict verdict={verdict} />}

      {/* Recent activity */}
      <Card className="mb-6">
        <CardContent className="p-5">
          <div className="text-xs text-muted-foreground tracking-wider uppercase mb-4">◎ Recent Activity</div>
          {history.length === 0 ? (
            <div className="text-xs text-muted-foreground">No activity yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-muted-foreground border-b border-border">
                    <th className="text-left py-1.5 pr-3">Time</th>
                    <th className="text-left py-1.5 pr-3">Action</th>
                    <th className="text-left py-1.5 pr-3">Pair</th>
                    <th className="text-left py-1.5 pr-3">Side</th>
                    <th className="text-right py-1.5 pr-3">Size</th>
                    <th className="text-right py-1.5 pr-3">Price</th>
                    <th className="text-right py-1.5 pr-3">Realized P&L</th>
                    <th className="text-left py-1.5">Status / Error</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((t) => (
                    <tr key={t.id} className="border-b border-border last:border-0">
                      <td className="py-1.5 pr-3 text-muted-foreground">
                        {new Date(t.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </td>
                      <td className="py-1.5 pr-3">{t.action}</td>
                      <td className="py-1.5 pr-3 font-semibold">{t.product_id || "—"}</td>
                      <td className="py-1.5 pr-3">{t.side || "—"}</td>
                      <td className="py-1.5 pr-3 text-right">{t.size ? fmt(Number(t.size), 6) : "—"}</td>
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
          <div>
            <div className="text-muted-foreground">Entry</div>
            <div className="font-bold text-base">{fUSD(scout.suggested_entry)}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Stop</div>
            <div className="font-bold text-base text-loss">{fUSD(scout.suggested_stop)}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Target</div>
            <div className="font-bold text-base text-profit">{fUSD(scout.suggested_target)}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Suggested size (1% risk)</div>
            <div className="font-bold text-base">{scout.suggested_size_usd ? fUSD(scout.suggested_size_usd) : "—"}</div>
          </div>
        </div>

        <div className="text-[10px] tracking-wider uppercase text-muted-foreground mb-1">Thesis</div>
        <p className="text-sm mb-3">{scout.thesis}</p>

        {scout.key_levels && Object.keys(scout.key_levels).length > 0 && (
          <div className="mb-3">
            <div className="text-[10px] tracking-wider uppercase text-muted-foreground mb-1">Key levels</div>
            <div className="flex flex-wrap gap-2">
              {Object.entries(scout.key_levels).map(([k, v]) => (
                <span key={k} className="text-[11px] bg-accent text-accent-foreground px-2 py-0.5 rounded">
                  {k}: {fUSD(v)}
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
              <div><span className="text-muted-foreground">In base: </span><span className="font-bold">{fmt(verdict.suggested_size_crypto, 8)}</span></div>
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
            const color =
              r.status === "PASS" ? "text-profit" :
              r.status === "FAIL" ? "text-loss" :
              r.status === "WARN" ? "text-amber" : "text-muted-foreground";
            const mark =
              r.status === "PASS" ? "✓" :
              r.status === "FAIL" ? "✗" :
              r.status === "WARN" ? "⚠" : "·";
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
