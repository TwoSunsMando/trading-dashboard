import { useState } from "react";
import { C } from "../constants";
import { fUSD, uid, td } from "../helpers";

export default function Watchlist({ watchlist, addWLItem, updateWLItem, deleteWLItem }) {
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
