import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";
import { C } from "../constants";
import { fmt, fUSD } from "../helpers";

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
