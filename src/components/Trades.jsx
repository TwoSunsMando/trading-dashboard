import { useState } from "react";
import { C } from "../constants";
import { fmt, fUSD, uid, td } from "../helpers";

export default function Trades({ trades, addTrade, updateTrade, deleteTrade, settings, curCap }) {
  const [show, setShow] = useState(false);
  const [f, setF] = useState({ ticker: "", entry: "", shares: "", stop: "", target: "", thesis: "", date: td(), type: "swing" });
  const [cfId, setCfId] = useState(null);
  const [cp, setCp] = useState("");
  const [filter, setFilter] = useState({ search: "", status: "all", type: "all" });
  const [sort, setSort] = useState({ field: "date", dir: "desc" });
  const maxR = curCap * (settings.maxRiskPct / 100);
  const maxP = curCap * (settings.maxPosPct / 100);
  const openN = trades.filter(t => t.status === "open").length;
  const iS = { background: C.bgIn, border: `1px solid ${C.border}`, borderRadius: 6, padding: "8px 12px", color: C.text, fontSize: 13, fontFamily: "inherit", width: "100%" };
  const fS = { background: C.bgIn, border: `1px solid ${C.border}`, borderRadius: 6, padding: "6px 10px", color: C.text, fontSize: 11, fontFamily: "inherit" };

  const filtered = trades
    .filter(t => filter.status === "all" || t.status === filter.status)
    .filter(t => filter.type === "all" || t.type === filter.type)
    .filter(t => !filter.search || t.ticker.toLowerCase().includes(filter.search.toLowerCase()))
    .sort((a, b) => {
      const d = sort.dir === "asc" ? 1 : -1;
      if (sort.field === "date") return d * (new Date(a.date) - new Date(b.date));
      if (sort.field === "pnl") return d * ((a.pnl || 0) - (b.pnl || 0));
      if (sort.field === "rr") return d * ((a.rr || 0) - (b.rr || 0));
      if (sort.field === "ticker") return d * a.ticker.localeCompare(b.ticker);
      return 0;
    });

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

      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
        <input style={{ ...fS, width: 140 }} value={filter.search} onChange={e => setFilter({ ...filter, search: e.target.value })} placeholder="Search ticker..." />
        <select style={fS} value={filter.status} onChange={e => setFilter({ ...filter, status: e.target.value })}>
          <option value="all">All Status</option><option value="open">Open</option><option value="closed">Closed</option>
        </select>
        <select style={fS} value={filter.type} onChange={e => setFilter({ ...filter, type: e.target.value })}>
          <option value="all">All Types</option><option value="swing">Swing</option><option value="position">Position</option><option value="etf">ETF</option>
        </select>
        <select style={fS} value={`${sort.field}-${sort.dir}`} onChange={e => { const [field, dir] = e.target.value.split("-"); setSort({ field, dir }); }}>
          <option value="date-desc">Newest First</option><option value="date-asc">Oldest First</option>
          <option value="pnl-desc">P&L High→Low</option><option value="pnl-asc">P&L Low→High</option>
          <option value="rr-desc">R:R High→Low</option><option value="rr-asc">R:R Low→High</option>
          <option value="ticker-asc">Ticker A→Z</option><option value="ticker-desc">Ticker Z→A</option>
        </select>
        {(filter.search || filter.status !== "all" || filter.type !== "all") && (
          <button onClick={() => setFilter({ search: "", status: "all", type: "all" })} style={{ background: "transparent", color: C.textM, border: `1px solid ${C.border}`, borderRadius: 6, padding: "5px 10px", fontSize: 10, cursor: "pointer", fontFamily: "inherit" }}>CLEAR</button>
        )}
        <span style={{ fontSize: 10, color: C.textM, marginLeft: "auto" }}>{filtered.length} of {trades.length} trades</span>
      </div>

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

      {filtered.length === 0 ? (
        <div style={{ textAlign: "center", padding: 60, color: C.textM }}><div style={{ fontSize: 32, marginBottom: 12 }}>◎</div><div>{trades.length === 0 ? "No trades logged yet." : "No trades match filters."}</div></div>
      ) : filtered.map(t => (
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
