import { useState } from "react";
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";
import { C } from "../constants";
import { fmt, fUSD, fPct } from "../helpers";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import TradingViewChart from "./TradingViewChart";
import TradingViewAnalysis from "./TradingViewAnalysis";

function Stat({ label, value, sub, color, icon }) {
  return (
    <Card className="flex-1 min-w-[140px]">
      <CardContent className="p-4">
        <div className="text-[10px] text-muted-foreground tracking-wider uppercase mb-2">{icon} {label}</div>
        <div className="text-xl font-bold" style={{ color }}>{value}</div>
        {sub && <div className="text-xs text-muted-foreground mt-1">{sub}</div>}
      </CardContent>
    </Card>
  );
}

function MRow({ label, value, color }) {
  return (
    <div>
      <div className="text-[10px] text-muted-foreground mb-0.5">{label}</div>
      <div className="text-base font-bold" style={{ color }}>{value}</div>
    </div>
  );
}

function SRow({ label, ok, text }) {
  return (
    <div className="flex justify-between py-1.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={cn("text-xs font-semibold", ok ? "text-profit" : "text-loss")}>{ok ? "✓" : "✗"} {text}</span>
    </div>
  );
}

export default function Dashboard({ settings, curCap, totalPnL, winRate, open, closed, maxRisk$, wkPnL, consLoss }) {
  const [chartTicker, setChartTicker] = useState(null);
  const [lookupInput, setLookupInput] = useState("");
  const ret = ((curCap - settings.capital) / settings.capital) * 100;
  const avgW = closed.filter(t => (t.pnl||0) > 0);
  const avgL = closed.filter(t => (t.pnl||0) < 0);
  const aW = avgW.length ? avgW.reduce((s,t) => s + t.pnl, 0) / avgW.length : 0;
  const aL = avgL.length ? avgL.reduce((s,t) => s + t.pnl, 0) / avgL.length : 0;
  const pf = aL !== 0 ? Math.abs(aW / aL) : 0;
  const mdd = (() => { let pk = settings.capital, mx = 0, r = settings.capital; closed.forEach(t => { r += (t.pnl||0); if (r > pk) pk = r; const d = ((pk-r)/pk)*100; if (d > mx) mx = d; }); return mx; })();

  const chartTooltipStyle = { backgroundColor: C.chartBg, border: `1px solid ${C.chartBorder}`, borderRadius: 8, fontSize: 12 };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-1">Dashboard</h1>
      <p className="text-muted-foreground text-xs mb-6">Your trading performance at a glance</p>

      {/* Quick Chart Lookup */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="text-xs text-muted-foreground tracking-wider uppercase">◈ Chart Lookup</div>
            <div className="flex gap-2 flex-1 min-w-[200px]">
              <Input
                value={lookupInput}
                onChange={e => setLookupInput(e.target.value.toUpperCase())}
                onKeyDown={e => { if (e.key === "Enter" && lookupInput.trim()) { setChartTicker(lookupInput.trim()); } }}
                placeholder="Type ticker and press Enter (e.g. AAPL)"
                className="flex-1 h-8 text-xs"
              />
              <Button size="sm" onClick={() => { if (lookupInput.trim()) setChartTicker(lookupInput.trim()); }} className="h-8 text-xs font-bold">CHART</Button>
              {chartTicker && <Button variant="outline" size="sm" onClick={() => { setChartTicker(null); setLookupInput(""); }} className="h-8 text-xs">Close</Button>}
            </div>
            {open.length > 0 && open.map(t => (
              <Button key={t.id} variant="outline" size="sm"
                onClick={() => { setChartTicker(t.ticker); setLookupInput(t.ticker); }}
                className={cn("h-7 text-[10px] font-semibold", chartTicker === t.ticker && "bg-primary text-primary-foreground")}>
                {t.ticker}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* TradingView Chart Panel */}
      {chartTicker && (
        <div className="mb-6 space-y-3">
          <div className="flex gap-3 flex-wrap">
            <Card className="flex-[2] min-w-[400px]">
              <CardContent className="p-0 overflow-hidden rounded-lg">
                <TradingViewChart symbol={`NASDAQ:${chartTicker}`} interval="D" height={460} studies={["STD;SMA;v19", "STD;RSI"]} />
              </CardContent>
            </Card>
            <Card className="flex-1 min-w-[280px]">
              <CardContent className="p-0 overflow-hidden rounded-lg">
                <TradingViewAnalysis symbol={`NASDAQ:${chartTicker}`} height={460} />
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Stat Cards */}
      <div className="flex flex-wrap gap-3 mb-6">
        <Stat icon="◈" label="Capital" value={fUSD(curCap)} sub={`Started: ${fUSD(settings.capital)}`} color={curCap >= settings.capital ? C.chartGreen : C.chartRed} />
        <Stat icon="◉" label="Total P&L" value={fUSD(totalPnL)} sub={fPct(ret)} color={totalPnL >= 0 ? C.chartGreen : C.chartRed} />
        <Stat icon="⬡" label="Win Rate" value={`${fmt(winRate,1)}%`} sub={`${avgW.length}W / ${avgL.length}L`} color={winRate >= 50 ? C.chartGreen : C.chartAmber} />
        <Stat icon="△" label="Week P&L" value={fUSD(wkPnL)} sub="Resets Sunday" color={wkPnL >= 0 ? C.chartGreen : C.chartRed} />
        <Stat icon="◆" label="Open" value={open.length} sub={`/ ${settings.maxPositions} max`} color={open.length >= settings.maxPositions ? C.chartAmber : C.chartCyan} />
        <Stat icon="◎" label="Risk/Trade" value={fUSD(maxRisk$)} sub={`${settings.maxRiskPct}% of capital`} color={C.chartCyan} />
      </div>

      {/* Performance & System Status */}
      <div className="flex gap-3 flex-wrap mb-6">
        <Card className="flex-1 min-w-[250px]">
          <CardContent className="p-5">
            <div className="text-xs text-muted-foreground tracking-wider uppercase mb-4">◆ Performance</div>
            <div className="grid grid-cols-2 gap-3">
              <MRow label="Avg Win" value={fUSD(aW)} color={C.chartGreen} />
              <MRow label="Avg Loss" value={fUSD(aL)} color={C.chartRed} />
              <MRow label="Profit Factor" value={fmt(pf,2)} color={pf >= 1.5 ? C.chartGreen : C.chartAmber} />
              <MRow label="Max Drawdown" value={fPct(-mdd)} color={mdd > 10 ? C.chartRed : C.chartAmber} />
              <MRow label="Total Trades" value={closed.length} color={C.chartTextBright} />
              <MRow label="Consec. Losses" value={consLoss} color={consLoss >= 3 ? C.chartRed : C.chartTextBright} />
            </div>
          </CardContent>
        </Card>
        <Card className="flex-1 min-w-[250px]">
          <CardContent className="p-5">
            <div className="text-xs text-muted-foreground tracking-wider uppercase mb-4">◆ System Status</div>
            <SRow label="Positions available" ok={open.length < settings.maxPositions} text={`${settings.maxPositions - open.length} of ${settings.maxPositions}`} />
            <SRow label="Weekly loss limit" ok={wkPnL > -(settings.capital * 0.03)} text={`${fUSD(wkPnL)} / ${fUSD(-settings.capital * 0.03)}`} />
            <SRow label="Consecutive losses" ok={consLoss < 3} text={`${consLoss} / 3 max`} />
            <SRow label="System compliance" ok={consLoss < 3 && open.length <= settings.maxPositions} text={consLoss < 3 && open.length <= settings.maxPositions ? "ALL CLEAR" : "CHECK RULES"} />
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      {closed.length > 1 && (() => {
        const eqData = (() => { let r = settings.capital; return [{ name: "Start", equity: r }, ...closed.map(t => { r += (t.pnl||0); return { name: t.ticker, equity: parseFloat(r.toFixed(2)), date: t.closeDate }; })]; })();
        const pnlData = closed.map(t => ({ name: t.ticker, pnl: parseFloat((t.pnl||0).toFixed(2)), date: t.closeDate }));
        return (
          <div className="flex gap-3 flex-wrap mb-6">
            <Card className="flex-1 min-w-[300px]">
              <CardContent className="p-5">
                <div className="text-xs text-muted-foreground tracking-wider uppercase mb-4">◈ Equity Curve</div>
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={eqData}>
                    <defs><linearGradient id="eqGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={C.chartGreen} stopOpacity={0.3}/><stop offset="95%" stopColor={C.chartGreen} stopOpacity={0}/></linearGradient></defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={C.chartBorder} />
                    <XAxis dataKey="name" tick={{ fill: C.chartText, fontSize: 10 }} stroke={C.chartBorder} />
                    <YAxis tick={{ fill: C.chartText, fontSize: 10 }} stroke={C.chartBorder} tickFormatter={v => `$${v.toLocaleString()}`} domain={['dataMin - 50', 'dataMax + 50']} />
                    <Tooltip contentStyle={chartTooltipStyle} labelStyle={{ color: C.chartTextBright }} formatter={(v) => [fUSD(v), "Equity"]} />
                    <ReferenceLine y={settings.capital} stroke={C.chartText} strokeDasharray="3 3" label={{ value: "Start", fill: C.chartText, fontSize: 10 }} />
                    <Area type="monotone" dataKey="equity" stroke={C.chartGreen} fill="url(#eqGrad)" strokeWidth={2} dot={{ fill: C.chartGreen, r: 3 }} activeDot={{ r: 5 }} />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            <Card className="flex-1 min-w-[300px]">
              <CardContent className="p-5">
                <div className="text-xs text-muted-foreground tracking-wider uppercase mb-4">◉ P&L Per Trade</div>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={pnlData}>
                    <CartesianGrid strokeDasharray="3 3" stroke={C.chartBorder} />
                    <XAxis dataKey="name" tick={{ fill: C.chartText, fontSize: 10 }} stroke={C.chartBorder} />
                    <YAxis tick={{ fill: C.chartText, fontSize: 10 }} stroke={C.chartBorder} tickFormatter={v => `$${v}`} />
                    <Tooltip contentStyle={chartTooltipStyle} labelStyle={{ color: C.chartTextBright }} formatter={(v) => [fUSD(v), "P&L"]} />
                    <ReferenceLine y={0} stroke={C.chartText} />
                    <Bar dataKey="pnl" radius={[4, 4, 0, 0]} fill={C.chartGreen} shape={(props) => {
                      const { x, y, width, height, payload } = props;
                      const fill = (payload.pnl || 0) >= 0 ? C.chartGreen : C.chartRed;
                      return <rect x={x} y={y} width={width} height={height} fill={fill} rx={4} />;
                    }} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        );
      })()}

      {/* Open Positions */}
      {open.length > 0 && (
        <Card className="mb-6">
          <CardContent className="p-5">
            <div className="text-xs text-muted-foreground tracking-wider uppercase mb-4">◎ Open Positions</div>
            {open.map(t => (
              <div key={t.id} className="flex justify-between items-center py-2 border-b border-border flex-wrap gap-2 last:border-0">
                <div>
                  <span className="font-bold text-info cursor-pointer hover:text-primary transition-colors" onClick={() => { setChartTicker(t.ticker); setLookupInput(t.ticker); }}>{t.ticker}</span>
                  <span className="text-muted-foreground ml-2 text-xs">{t.shares} @ {fUSD(t.entry)}</span>
                </div>
                <div className="text-xs text-muted-foreground">Stop: {fUSD(t.stop)} | Target: {fUSD(t.target)}</div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

    </div>
  );
}
