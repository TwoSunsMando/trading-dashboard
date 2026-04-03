import { useState } from "react";
import { C } from "../constants";
import { fmt, fUSD } from "../helpers";

export default function Calc({ settings, setSettings, curCap }) {
  const [entry, setEntry] = useState("");
  const [stop, setStop] = useState("");
  const [target, setTarget] = useState("");
  const riskD = curCap * (settings.maxRiskPct / 100);
  const maxPD = curCap * (settings.maxPosPct / 100);
  const eN = parseFloat(entry), sN = parseFloat(stop), tN = parseFloat(target);
  const rps = eN && sN ? Math.abs(eN - sN) : 0;
  const idealSh = rps > 0 ? Math.floor(riskD / rps) : 0;
  const maxSh = eN > 0 ? Math.floor(maxPD / eN) : 0;
  const finalSh = Math.min(idealSh, maxSh);
  const posVal = finalSh * eN, totRisk = finalSh * rps;
  const rr = rps > 0 && tN ? (tN - eN) / rps : 0;
  const potProfit = finalSh * (tN - eN);
  const iS = { background: C.bgIn, border: `1px solid ${C.border}`, borderRadius: 6, padding: "10px 14px", color: C.text, fontSize: 15, fontFamily: "inherit", width: "100%", fontWeight: 600 };

  return (
    <div>
      <div style={{ fontFamily: "'Instrument Sans', sans-serif", fontSize: 24, fontWeight: 700, marginBottom: 4 }}>Position Size Calculator</div>
      <div style={{ color: C.textD, fontSize: 12, marginBottom: 24 }}>The calculator enforces discipline.</div>
      <div style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 10, padding: 18, marginBottom: 20 }}>
        <div style={{ fontSize: 10, color: C.textM, letterSpacing: 1, textTransform: "uppercase", marginBottom: 12 }}>◆ Account Settings</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
          <div><label style={{ fontSize: 10, color: C.textM, display: "block", marginBottom: 4 }}>STARTING CAPITAL</label><input style={iS} type="number" value={settings.capital} onChange={e => setSettings({...settings, capital: parseFloat(e.target.value)||0})} /></div>
          <div><label style={{ fontSize: 10, color: C.textM, display: "block", marginBottom: 4 }}>MAX RISK %</label><input style={iS} type="number" step="0.25" value={settings.maxRiskPct} onChange={e => setSettings({...settings, maxRiskPct: parseFloat(e.target.value)||1})} /></div>
          <div><label style={{ fontSize: 10, color: C.textM, display: "block", marginBottom: 4 }}>MAX POSITIONS</label><input style={iS} type="number" value={settings.maxPositions} onChange={e => setSettings({...settings, maxPositions: parseInt(e.target.value)||3})} /></div>
          <div><label style={{ fontSize: 10, color: C.textM, display: "block", marginBottom: 4 }}>MAX POS %</label><input style={iS} type="number" step="5" value={settings.maxPosPct} onChange={e => setSettings({...settings, maxPosPct: parseFloat(e.target.value)||20})} /></div>
        </div>
        <div style={{ fontSize: 11, color: C.green, marginTop: 12 }}>Current capital: <strong>{fUSD(curCap)}</strong> → Max risk/trade: <strong>{fUSD(riskD)}</strong></div>
      </div>
      <div style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 10, padding: 18 }}>
        <div style={{ fontSize: 10, color: C.green, letterSpacing: 1, textTransform: "uppercase", marginBottom: 16 }}>⬡ Calculate</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: 20 }}>
          <div><label style={{ fontSize: 10, color: C.textM, display: "block", marginBottom: 4 }}>ENTRY PRICE</label><input style={iS} type="number" step="0.01" value={entry} onChange={e => setEntry(e.target.value)} placeholder="0.00" /></div>
          <div><label style={{ fontSize: 10, color: C.textM, display: "block", marginBottom: 4 }}>STOP LOSS</label><input style={iS} type="number" step="0.01" value={stop} onChange={e => setStop(e.target.value)} placeholder="0.00" /></div>
          <div><label style={{ fontSize: 10, color: C.textM, display: "block", marginBottom: 4 }}>TARGET</label><input style={iS} type="number" step="0.01" value={target} onChange={e => setTarget(e.target.value)} placeholder="0.00" /></div>
        </div>
        {eN > 0 && sN > 0 && (
          <div style={{ background: C.bgEl, borderRadius: 10, padding: 20, border: `1px solid ${C.borderB}` }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 16, textAlign: "center" }}>
              <div><div style={{ fontSize: 10, color: C.textM, letterSpacing: 1, marginBottom: 4 }}>SHARES TO BUY</div><div style={{ fontSize: 32, fontWeight: 700, color: C.green, fontFamily: "'Instrument Sans',sans-serif" }}>{finalSh}</div></div>
              <div><div style={{ fontSize: 10, color: C.textM, letterSpacing: 1, marginBottom: 4 }}>POSITION VALUE</div><div style={{ fontSize: 20, fontWeight: 700, color: C.text, fontFamily: "'Instrument Sans',sans-serif" }}>{fUSD(posVal)}</div></div>
              <div><div style={{ fontSize: 10, color: C.textM, letterSpacing: 1, marginBottom: 4 }}>TOTAL RISK</div><div style={{ fontSize: 20, fontWeight: 700, color: C.red, fontFamily: "'Instrument Sans',sans-serif" }}>{fUSD(totRisk)}</div></div>
              {tN > 0 && <div><div style={{ fontSize: 10, color: C.textM, letterSpacing: 1, marginBottom: 4 }}>R:R RATIO</div><div style={{ fontSize: 20, fontWeight: 700, color: rr >= 2 ? C.green : C.red, fontFamily: "'Instrument Sans',sans-serif" }}>{fmt(rr,1)}:1</div></div>}
              {tN > 0 && <div><div style={{ fontSize: 10, color: C.textM, letterSpacing: 1, marginBottom: 4 }}>POTENTIAL PROFIT</div><div style={{ fontSize: 20, fontWeight: 700, color: C.green, fontFamily: "'Instrument Sans',sans-serif" }}>{fUSD(potProfit)}</div></div>}
            </div>
            {idealSh > maxSh && <div style={{ marginTop: 14, fontSize: 11, color: C.amber, background: C.amberD, padding: 10, borderRadius: 6 }}>⚠ Capped by {settings.maxPosPct}% rule ({idealSh} → {finalSh} shares)</div>}
            {rr > 0 && rr < 2 && <div style={{ marginTop: 10, fontSize: 11, color: C.red, background: C.redD, padding: 10, borderRadius: 6 }}>⚠ R:R below 2:1. Rule E3: trade does NOT qualify.</div>}
          </div>
        )}
      </div>
    </div>
  );
}
