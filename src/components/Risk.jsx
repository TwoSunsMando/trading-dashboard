import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";
import { C } from "../constants";
import { fmt, fUSD } from "../helpers";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export default function Risk({ trades, settings, curCap, closed, wkPnL }) {
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
      <Card>
        <CardContent className="p-4">
          <div className="text-[10px] text-muted-foreground tracking-wider uppercase mb-2">{label}</div>
          <div className="text-xl font-bold mb-2" style={{ color }}>{pre}{unit === "$" ? fUSD(value) : `${fmt(value,1)}%`}</div>
          <div className="h-1.5 bg-accent rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: color }} />
          </div>
          <div className="text-[10px] text-muted-foreground mt-1">of {unit === "$" ? fUSD(max) : `${max}%`} limit</div>
        </CardContent>
      </Card>
    );
  };

  const chartTooltipStyle = { backgroundColor: C.chartBg, border: `1px solid ${C.chartBorder}`, borderRadius: 8, fontSize: 12 };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-1">Risk & Drawdown</h1>
      <p className="text-muted-foreground text-xs mb-6">Capital preservation is job #1.</p>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-3 mb-6">
        <Gauge label="Open Risk" value={totOR} max={curCap * (settings.maxRiskPct/100) * settings.maxPositions} unit="$" color={C.chartRed} />
        <Gauge label="Exposure" value={expPct} max={100} unit="%" color={C.chartAmber} />
        <Gauge label="Weekly P&L" value={Math.abs(wkPnL)} max={wkLim} unit="$" color={wkPnL >= 0 ? C.chartGreen : C.chartRed} pre={wkPnL >= 0 ? "+" : "-"} />
        <Gauge label="Max Drawdown" value={mdd} max={15} unit="%" color={mdd > 10 ? C.chartRed : mdd > 5 ? C.chartAmber : C.chartGreen} />
      </div>

      {eq.length > 1 && (
        <Card className="mb-5">
          <CardContent className="p-5">
            <div className="text-xs text-muted-foreground tracking-wider uppercase mb-3.5">◈ Equity Curve</div>
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={eq}>
                <defs><linearGradient id="riskEqGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={C.chartCyan} stopOpacity={0.3}/><stop offset="95%" stopColor={C.chartCyan} stopOpacity={0}/></linearGradient></defs>
                <CartesianGrid strokeDasharray="3 3" stroke={C.chartBorder} />
                <XAxis dataKey="name" tick={{ fill: C.chartText, fontSize: 10 }} stroke={C.chartBorder} />
                <YAxis tick={{ fill: C.chartText, fontSize: 10 }} stroke={C.chartBorder} tickFormatter={v => `$${v.toLocaleString()}`} domain={['dataMin - 50', 'dataMax + 50']} />
                <Tooltip contentStyle={chartTooltipStyle} labelStyle={{ color: C.chartTextBright }} formatter={(v) => [fUSD(v), "Equity"]} />
                <ReferenceLine y={settings.capital} stroke={C.chartText} strokeDasharray="3 3" label={{ value: "Start", fill: C.chartText, fontSize: 10 }} />
                <Area type="monotone" dataKey="equity" stroke={C.chartCyan} fill="url(#riskEqGrad)" strokeWidth={2} dot={{ fill: C.chartCyan, r: 3 }} activeDot={{ r: 5 }} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {open.length > 0 && (
        <Card>
          <CardContent className="p-5">
            <div className="text-xs text-muted-foreground tracking-wider uppercase mb-3.5">◉ Position Risk</div>
            {open.map(t => (
              <div key={t.id} className="flex justify-between py-2 border-b border-border text-xs flex-wrap gap-2 last:border-0">
                <span className="text-info font-bold">{t.ticker}</span>
                <span className="text-muted-foreground">{t.shares} shares</span>
                <span className="text-muted-foreground">Size: {fUSD(t.positionSize)}</span>
                <span className="text-loss">Risk: {fUSD(t.totalRisk)}</span>
                <span className="text-muted-foreground">{fmt((t.positionSize/curCap)*100,1)}%</span>
              </div>
            ))}
            <div className="flex justify-between pt-2.5 text-xs font-bold flex-wrap gap-2">
              <span className="text-foreground">TOTAL</span>
              <span className="text-foreground">{fUSD(totExp)}</span>
              <span className="text-loss">{fUSD(totOR)}</span>
              <span className="text-foreground">{fmt(expPct,1)}%</span>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
