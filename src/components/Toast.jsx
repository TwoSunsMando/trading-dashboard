import { C } from "../constants";

export function Toast({ toasts, removeToast }) {
  return (
    <div style={{ position: "fixed", top: 16, right: 16, zIndex: 9999, display: "flex", flexDirection: "column", gap: 8 }}>
      {toasts.map(t => (
        <div key={t.id} onClick={() => removeToast(t.id)} style={{
          background: t.type === "error" ? C.redD : t.type === "success" ? C.greenD : C.amberD,
          border: `1px solid ${t.type === "error" ? C.red : t.type === "success" ? C.green : C.amber}40`,
          color: t.type === "error" ? C.red : t.type === "success" ? C.green : C.amber,
          padding: "10px 16px", borderRadius: 8, fontSize: 12, fontFamily: "'IBM Plex Mono', monospace",
          cursor: "pointer", maxWidth: 320, backdropFilter: "blur(12px)", animation: "toastIn 0.2s ease-out",
        }}>
          {t.type === "error" ? "✗ " : t.type === "success" ? "✓ " : "⚠ "}{t.message}
        </div>
      ))}
    </div>
  );
}

export function ConfirmDialog({ message, onConfirm, onCancel }) {
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 9998, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(4px)" }}>
      <div style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 12, padding: 24, maxWidth: 360, width: "90%", textAlign: "center" }}>
        <div style={{ fontSize: 13, color: C.text, marginBottom: 20, lineHeight: 1.5 }}>{message}</div>
        <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
          <button onClick={onCancel} style={{ background: C.bgEl, color: C.textD, border: `1px solid ${C.border}`, borderRadius: 6, padding: "8px 20px", fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>CANCEL</button>
          <button onClick={onConfirm} style={{ background: C.red, color: "#fff", border: "none", borderRadius: 6, padding: "8px 20px", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>DELETE</button>
        </div>
      </div>
    </div>
  );
}
