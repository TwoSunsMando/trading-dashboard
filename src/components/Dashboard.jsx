import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";
import { C } from "../constants";
import { fmt, fUSD, fPct } from "../helpers";

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

export default function Dashboard({ settings, curCap, totalPnL, winRate, open, closed, maxRisk$, wkPnL, consLoss }) {
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
