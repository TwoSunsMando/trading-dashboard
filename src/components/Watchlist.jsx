import { useState } from "react";
import { fUSD, uid, td } from "../helpers";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import TradingViewChart from "./TradingViewChart";
import TradingViewAnalysis from "./TradingViewAnalysis";
import TradingViewMiniChart from "./TradingViewMiniChart";

export default function Watchlist({ watchlist, addWLItem, updateWLItem, deleteWLItem }) {
  const [f, setF] = useState({ ticker: "", notes: "", setup: "breakout", alert: "" });
  const [selectedTicker, setSelectedTicker] = useState(null);

  const add = () => {
    if (!f.ticker) return;
    addWLItem({ id: uid(), ticker: f.ticker.toUpperCase(), notes: f.notes, setup: f.setup, alert: f.alert ? parseFloat(f.alert) : null, date: td(), status: "watching" });
    setF({ ticker: "", notes: "", setup: "breakout", alert: "" });
  };

  const cycleStatus = (w) => {
    const next = w.status === "watching" ? "ready" : w.status === "ready" ? "triggered" : "watching";
    updateWLItem(w.id, { status: next });
  };

  const statusStyle = {
    watching: "bg-muted text-muted-foreground",
    ready: "bg-warn-muted text-warn",
    triggered: "bg-profit-muted text-profit",
  };

  const tvSymbol = (ticker) => {
    const etfs = ["SPY", "QQQ", "IWM", "XLF", "XLE", "GLD", "TLT", "DIA", "VTI", "VOO"];
    if (etfs.includes(ticker.toUpperCase())) return `AMEX:${ticker.toUpperCase()}`;
    return `NASDAQ:${ticker.toUpperCase()}`;
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-1">Watchlist</h1>
      <p className="text-muted-foreground text-xs mb-6">Sunday scan → Monday entries. Click a ticker to analyze.</p>

      <Card className="mb-5">
        <CardContent className="p-5">
          <div className="grid grid-cols-[repeat(auto-fit,minmax(140px,1fr))] gap-3">
            <div><label className="text-[10px] text-muted-foreground block mb-1">TICKER</label><Input value={f.ticker} onChange={e => setF({...f, ticker: e.target.value})} placeholder="MSFT" /></div>
            <div><label className="text-[10px] text-muted-foreground block mb-1">SETUP</label>
              <select className="w-full h-9 rounded-md border border-border bg-input px-3 text-sm text-foreground" value={f.setup} onChange={e => setF({...f, setup: e.target.value})}><option value="breakout">Breakout</option><option value="pullback">Pullback to MA</option><option value="bounce">Bounce off Support</option><option value="etf">ETF Rotation</option><option value="other">Other</option></select>
            </div>
            <div><label className="text-[10px] text-muted-foreground block mb-1">ALERT PRICE</label><Input type="number" step="0.01" value={f.alert} onChange={e => setF({...f, alert: e.target.value})} placeholder="0.00" /></div>
          </div>
          <div className="mt-3"><label className="text-[10px] text-muted-foreground block mb-1">NOTES</label><Input value={f.notes} onChange={e => setF({...f, notes: e.target.value})} placeholder="Consolidating near resistance. Watch volume." /></div>
          <Button onClick={add} className="mt-3 font-bold text-xs">+ ADD</Button>
        </CardContent>
      </Card>

      {/* Chart + Analysis panel when ticker selected */}
      {selectedTicker && (
        <div className="mb-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-foreground">{selectedTicker} — Chart & Analysis</h2>
            <Button variant="outline" size="sm" onClick={() => setSelectedTicker(null)} className="text-xs">Close</Button>
          </div>
          <div className="flex gap-3 flex-wrap">
            <Card className="flex-[2] min-w-[400px]">
              <CardContent className="p-0 overflow-hidden rounded-lg">
                <TradingViewChart symbol={tvSymbol(selectedTicker)} interval="D" height={460} studies={["STD;SMA;v19", "STD;RSI"]} />
              </CardContent>
            </Card>
            <Card className="flex-1 min-w-[280px]">
              <CardContent className="p-0 overflow-hidden rounded-lg">
                <TradingViewAnalysis symbol={tvSymbol(selectedTicker)} height={460} />
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {watchlist.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <div className="text-3xl mb-3">◎</div>
          <div>Empty. Do your Sunday scan.</div>
        </div>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-3">
          {watchlist.map(w => (
            <Card key={w.id} className={cn("cursor-pointer transition-all hover:border-primary/50", selectedTicker === w.ticker && "border-primary")}>
              <CardContent className="p-0">
                {/* Mini chart */}
                <div className="pointer-events-none" onClick={e => e.stopPropagation()}>
                  <TradingViewMiniChart symbol={tvSymbol(w.ticker)} height={140} dateRange="1M" />
                </div>
                {/* Info row */}
                <div className="px-3.5 pb-3 -mt-2">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="font-bold text-sm text-foreground cursor-pointer hover:text-primary" onClick={() => setSelectedTicker(selectedTicker === w.ticker ? null : w.ticker)}>{w.ticker}</span>
                    <Badge variant="outline" onClick={(e) => { e.stopPropagation(); cycleStatus(w); }}
                      className={cn("text-[10px] font-semibold cursor-pointer border-0 uppercase", statusStyle[w.status])}>
                      {w.status}
                    </Badge>
                    <span className="text-[10px] text-muted-foreground uppercase">{w.setup}</span>
                    {w.alert && <span className="text-xs text-warn">@ {fUSD(w.alert)}</span>}
                    <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); deleteWLItem(w.id); }} className="h-6 text-[10px] px-1.5 ml-auto">✗</Button>
                  </div>
                  {w.notes && <div className="text-xs text-muted-foreground">{w.notes}</div>}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
