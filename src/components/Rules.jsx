import { useState } from "react";
import { RULES } from "../constants";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export default function Rules() {
  const [exp, setExp] = useState(null);

  const Sec = ({ title, rules, color, icon }) => (
    <Card className="mb-4">
      <CardContent className="p-5">
        <div className="text-xs tracking-wider uppercase mb-3.5 font-bold" style={{ color }}>{icon} {title}</div>
        {rules.map(r => (
          <div key={r.id} onClick={() => setExp(exp === r.id ? null : r.id)} className="cursor-pointer py-2.5 border-b border-border last:border-0">
            <div className="flex items-start gap-2.5">
              <span className="font-bold text-xs min-w-[24px]" style={{ color }}>{r.id}</span>
              <span className="text-foreground text-sm font-medium">{r.rule}</span>
              <span className="text-muted-foreground ml-auto text-[10px]">{exp === r.id ? "▲" : "▼"}</span>
            </div>
            {exp === r.id && <div className="mt-2 ml-[34px] text-xs text-muted-foreground leading-relaxed bg-accent p-3 rounded-md">{r.detail}</div>}
          </div>
        ))}
      </CardContent>
    </Card>
  );

  return (
    <div>
      <h1 className="text-2xl font-bold mb-1">System Rules</h1>
      <p className="text-muted-foreground text-xs mb-2">{RULES.name}</p>
      <div className="text-profit text-sm italic mb-6 border-l-2 border-profit pl-3">"{RULES.philosophy}"</div>

      <Sec title="Risk Management" rules={RULES.risk} color="#f87171" icon="△" />
      <Sec title="Entry Rules" rules={RULES.entry} color="#34d399" icon="◈" />
      <Sec title="Exit Rules" rules={RULES.exit} color="#fbbf24" icon="◉" />

      <Card className="mb-4">
        <CardContent className="p-5">
          <div className="text-xs text-info tracking-wider uppercase mb-3.5 font-bold">◎ Weekly Routine</div>
          {RULES.routine.map((r, i) => (
            <div key={i} className="flex gap-3 py-2 border-b border-border last:border-0">
              <span className="text-info font-bold text-xs min-w-[80px]">{r.day}</span>
              <span className="text-muted-foreground text-xs">{r.task}</span>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-5">
          <div className="text-xs text-primary tracking-wider uppercase mb-3.5 font-bold">◆ ETF Playbook</div>
          {RULES.etfs.map((e, i) => (
            <div key={i} className="flex gap-3 py-2 border-b border-border last:border-0">
              <span className="text-primary font-bold text-sm min-w-[40px]">{e.ticker}</span>
              <div>
                <span className="text-foreground text-xs font-medium">{e.name}</span>
                <div className="text-muted-foreground text-xs mt-0.5">{e.use}</div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
