import { useState } from "react";
import { C, RULES } from "../constants";

export default function Rules() {
  const [exp, setExp] = useState(null);
  const Sec = ({ title, rules, color, icon }) => (
    <div style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 10, padding: 18, marginBottom: 16 }}>
      <div style={{ fontSize: 12, color, letterSpacing: 1, textTransform: "uppercase", marginBottom: 14, fontWeight: 700 }}>{icon} {title}</div>
      {rules.map(r => (
        <div key={r.id} onClick={() => setExp(exp === r.id ? null : r.id)} style={{ cursor: "pointer", padding: "10px 0", borderBottom: `1px solid ${C.border}` }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
            <span style={{ color, fontWeight: 700, fontSize: 11, minWidth: 24 }}>{r.id}</span>
            <span style={{ color: C.text, fontSize: 13, fontWeight: 500 }}>{r.rule}</span>
            <span style={{ color: C.textM, marginLeft: "auto", fontSize: 10 }}>{exp === r.id ? "▲" : "▼"}</span>
          </div>
          {exp === r.id && <div style={{ marginTop: 8, marginLeft: 34, fontSize: 12, color: C.textD, lineHeight: 1.6, background: C.bgEl, padding: 12, borderRadius: 6 }}>{r.detail}</div>}
        </div>
      ))}
    </div>
  );

  return (
    <div>
      <div style={{ fontFamily: "'Instrument Sans', sans-serif", fontSize: 24, fontWeight: 700, marginBottom: 4 }}>System Rules</div>
      <div style={{ color: C.textD, fontSize: 12, marginBottom: 8 }}>{RULES.name}</div>
      <div style={{ color: C.green, fontSize: 13, fontStyle: "italic", marginBottom: 24, borderLeft: `2px solid ${C.green}`, paddingLeft: 12 }}>"{RULES.philosophy}"</div>
      <Sec title="Risk Management" rules={RULES.risk} color={C.red} icon="△" />
      <Sec title="Entry Rules" rules={RULES.entry} color={C.green} icon="◈" />
      <Sec title="Exit Rules" rules={RULES.exit} color={C.amber} icon="◉" />
      <div style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 10, padding: 18, marginBottom: 16 }}>
        <div style={{ fontSize: 12, color: C.cyan, letterSpacing: 1, textTransform: "uppercase", marginBottom: 14, fontWeight: 700 }}>◎ Weekly Routine</div>
        {RULES.routine.map((r, i) => (
          <div key={i} style={{ display: "flex", gap: 12, padding: "8px 0", borderBottom: `1px solid ${C.border}` }}>
            <span style={{ color: C.cyan, fontWeight: 700, fontSize: 11, minWidth: 80 }}>{r.day}</span>
            <span style={{ color: C.textD, fontSize: 12 }}>{r.task}</span>
          </div>
        ))}
      </div>
      <div style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 10, padding: 18 }}>
        <div style={{ fontSize: 12, color: C.purple, letterSpacing: 1, textTransform: "uppercase", marginBottom: 14, fontWeight: 700 }}>◆ ETF Playbook</div>
        {RULES.etfs.map((e, i) => (
          <div key={i} style={{ display: "flex", gap: 12, padding: "8px 0", borderBottom: `1px solid ${C.border}` }}>
            <span style={{ color: C.purple, fontWeight: 700, fontSize: 13, minWidth: 40, fontFamily: "'Instrument Sans',sans-serif" }}>{e.ticker}</span>
            <div><span style={{ color: C.text, fontSize: 12, fontWeight: 500 }}>{e.name}</span><div style={{ color: C.textD, fontSize: 11, marginTop: 2 }}>{e.use}</div></div>
          </div>
        ))}
      </div>
    </div>
  );
}
