import { cn } from "@/lib/utils";

export function Toast({ toasts, removeToast }) {
  return (
    <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2">
      {toasts.map(t => (
        <div key={t.id} onClick={() => removeToast(t.id)} className={cn(
          "px-4 py-2.5 rounded-lg text-xs cursor-pointer max-w-[320px] backdrop-blur-xl border animate-in slide-in-from-right-5",
          t.type === "error" && "bg-loss-muted border-loss/40 text-loss",
          t.type === "success" && "bg-profit-muted border-profit/40 text-profit",
          t.type !== "error" && t.type !== "success" && "bg-warn-muted border-warn/40 text-warn",
        )}>
          {t.type === "error" ? "✗ " : t.type === "success" ? "✓ " : "⚠ "}{t.message}
        </div>
      ))}
    </div>
  );
}

export function ConfirmDialog({ message, onConfirm, onCancel }) {
  return (
    <div className="fixed inset-0 z-[9998] bg-black/60 flex items-center justify-center backdrop-blur-sm">
      <div className="bg-card border border-border rounded-xl p-6 max-w-[360px] w-[90%] text-center shadow-2xl">
        <p className="text-sm text-foreground mb-5 leading-relaxed">{message}</p>
        <div className="flex gap-2.5 justify-center">
          <button onClick={onCancel} className="bg-accent text-muted-foreground border border-border rounded-md px-5 py-2 text-xs cursor-pointer hover:bg-accent/80 transition-colors">CANCEL</button>
          <button onClick={onConfirm} className="bg-loss text-white border-none rounded-md px-5 py-2 text-xs font-bold cursor-pointer hover:bg-loss/80 transition-colors">DELETE</button>
        </div>
      </div>
    </div>
  );
}
