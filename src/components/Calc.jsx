import { useState } from "react";
import { C } from "../constants";
import { fmt, fUSD } from "../helpers";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

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

  return (
    <div>
      <h1 className="text-2xl font-bold mb-1">Position Size Calculator</h1>
      <p className="text-muted-foreground text-xs mb-6">The calculator enforces discipline.</p>

      <Card className="mb-5">
        <CardContent className="p-5">
          <div className="text-[10px] text-muted-foreground tracking-wider uppercase mb-3">◆ Account Settings</div>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(160px,1fr))] gap-3">
            <div><label className="text-[10px] text-muted-foreground block mb-1">STARTING CAPITAL</label><Input type="number" value={settings.capital} onChange={e => setSettings({...settings, capital: parseFloat(e.target.value)||0})} className="font-semibold" /></div>
            <div><label className="text-[10px] text-muted-foreground block mb-1">MAX RISK %</label><Input type="number" step="0.25" value={settings.maxRiskPct} onChange={e => setSettings({...settings, maxRiskPct: parseFloat(e.target.value)||1})} className="font-semibold" /></div>
            <div><label className="text-[10px] text-muted-foreground block mb-1">MAX POSITIONS</label><Input type="number" value={settings.maxPositions} onChange={e => setSettings({...settings, maxPositions: parseInt(e.target.value)||3})} className="font-semibold" /></div>
            <div><label className="text-[10px] text-muted-foreground block mb-1">MAX POS %</label><Input type="number" step="5" value={settings.maxPosPct} onChange={e => setSettings({...settings, maxPosPct: parseFloat(e.target.value)||20})} className="font-semibold" /></div>
          </div>
          <div className="text-xs text-profit mt-3">Current capital: <strong>{fUSD(curCap)}</strong> → Max risk/trade: <strong>{fUSD(riskD)}</strong></div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-5">
          <div className="text-xs text-primary tracking-wider uppercase mb-4 font-medium">⬡ Calculate</div>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(160px,1fr))] gap-3 mb-5">
            <div><label className="text-[10px] text-muted-foreground block mb-1">ENTRY PRICE</label><Input type="number" step="0.01" value={entry} onChange={e => setEntry(e.target.value)} placeholder="0.00" className="font-semibold text-base" /></div>
            <div><label className="text-[10px] text-muted-foreground block mb-1">STOP LOSS</label><Input type="number" step="0.01" value={stop} onChange={e => setStop(e.target.value)} placeholder="0.00" className="font-semibold text-base" /></div>
            <div><label className="text-[10px] text-muted-foreground block mb-1">TARGET</label><Input type="number" step="0.01" value={target} onChange={e => setTarget(e.target.value)} placeholder="0.00" className="font-semibold text-base" /></div>
          </div>
          {eN > 0 && sN > 0 && (
            <div className="bg-accent rounded-xl p-5 border border-border">
              <div className="grid grid-cols-[repeat(auto-fit,minmax(140px,1fr))] gap-4 text-center">
                <div>
                  <div className="text-[10px] text-muted-foreground tracking-wider mb-1">SHARES TO BUY</div>
                  <div className="text-3xl font-bold text-profit">{finalSh}</div>
                </div>
                <div>
                  <div className="text-[10px] text-muted-foreground tracking-wider mb-1">POSITION VALUE</div>
                  <div className="text-xl font-bold text-foreground">{fUSD(posVal)}</div>
                </div>
                <div>
                  <div className="text-[10px] text-muted-foreground tracking-wider mb-1">TOTAL RISK</div>
                  <div className="text-xl font-bold text-loss">{fUSD(totRisk)}</div>
                </div>
                {tN > 0 && <div>
                  <div className="text-[10px] text-muted-foreground tracking-wider mb-1">R:R RATIO</div>
                  <div className={cn("text-xl font-bold", rr >= 2 ? "text-profit" : "text-loss")}>{fmt(rr,1)}:1</div>
                </div>}
                {tN > 0 && <div>
                  <div className="text-[10px] text-muted-foreground tracking-wider mb-1">POTENTIAL PROFIT</div>
                  <div className="text-xl font-bold text-profit">{fUSD(potProfit)}</div>
                </div>}
              </div>
              {idealSh > maxSh && <div className="mt-3.5 text-xs text-warn bg-warn-muted p-2.5 rounded-md">⚠ Capped by {settings.maxPosPct}% rule ({idealSh} → {finalSh} shares)</div>}
              {rr > 0 && rr < 2 && <div className="mt-2.5 text-xs text-loss bg-loss-muted p-2.5 rounded-md">⚠ R:R below 2:1. Rule E3: trade does NOT qualify.</div>}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
