import { useState } from "react";
import { fmt, fUSD, uid, td, SETUPS, setupLabel } from "../helpers";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export default function Trades({ trades, addTrade, updateTrade, deleteTrade, settings, curCap }) {
  const [show, setShow] = useState(false);
  const [f, setF] = useState({ ticker: "", entry: "", shares: "", stop: "", target: "", thesis: "", date: td(), type: "swing", setup: "breakout" });
  const [cfId, setCfId] = useState(null);
  const [closeForm, setCloseForm] = useState({ price: "", lessons: "", mistakes: "", followedRules: true, emotion: "" });
  const [editJournalId, setEditJournalId] = useState(null);
  const [journalForm, setJournalForm] = useState({ lessons: "", mistakes: "", followedRules: true, emotion: "" });
  const [filter, setFilter] = useState({ search: "", status: "all", type: "all", setup: "all" });
  const [sort, setSort] = useState({ field: "date", dir: "desc" });
  const maxR = curCap * (settings.maxRiskPct / 100);
  const maxP = curCap * (settings.maxPosPct / 100);
  const openN = trades.filter(t => t.status === "open").length;

  const filtered = trades
    .filter(t => filter.status === "all" || t.status === filter.status)
    .filter(t => filter.type === "all" || t.type === filter.type)
    .filter(t => filter.setup === "all" || t.setup === filter.setup)
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
    addTrade({ id: uid(), ticker: f.ticker.toUpperCase(), entry: e, stop: s, target: tg, shares: sh, thesis: f.thesis, date: f.date, type: f.type, setup: f.setup, status: "open", riskPerShare: rps, totalRisk: tr, positionSize: ps, rr, closeDate: null, closePrice: null, pnl: null });
    setF({ ticker: "", entry: "", shares: "", stop: "", target: "", thesis: "", date: td(), type: "swing", setup: "breakout" });
    setShow(false);
  };

  const startClose = (id) => {
    setCfId(id);
    setCloseForm({ price: "", lessons: "", mistakes: "", followedRules: true, emotion: "" });
  };

  const close = (id) => {
    const c = parseFloat(closeForm.price); if (isNaN(c)) return;
    const t = trades.find(t => t.id === id);
    updateTrade(id, {
      status: "closed", closeDate: td(), closePrice: c, pnl: (c - t.entry) * t.shares,
      journalLessons: closeForm.lessons, journalMistakes: closeForm.mistakes,
      followedRules: closeForm.followedRules, emotion: closeForm.emotion,
    });
    setCfId(null);
    setCloseForm({ price: "", lessons: "", mistakes: "", followedRules: true, emotion: "" });
  };

  const startEditJournal = (t) => {
    setEditJournalId(t.id);
    setJournalForm({
      lessons: t.journalLessons || "",
      mistakes: t.journalMistakes || "",
      followedRules: t.followedRules ?? true,
      emotion: t.emotion || "",
    });
  };

  const saveJournal = (id) => {
    updateTrade(id, {
      journalLessons: journalForm.lessons,
      journalMistakes: journalForm.mistakes,
      followedRules: journalForm.followedRules,
      emotion: journalForm.emotion,
    });
    setEditJournalId(null);
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-5 flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold">Trade Log</h1>
          <p className="text-muted-foreground text-xs">Every trade documented. No exceptions.</p>
        </div>
        <Button onClick={() => setShow(!show)} className="font-bold text-xs">{show ? "CANCEL" : "+ NEW TRADE"}</Button>
      </div>

      {openN >= settings.maxPositions && (
        <div className="bg-loss-muted border border-loss/30 rounded-lg p-3 mb-4 text-xs text-loss font-semibold">
          ⚠ MAX POSITIONS ({settings.maxPositions}). Close one before opening new.
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-2 mb-4 flex-wrap items-center">
        <Input className="w-[140px] h-8 text-xs" value={filter.search} onChange={e => setFilter({ ...filter, search: e.target.value })} placeholder="Search ticker..." />
        <select className="h-8 rounded-md border border-border bg-input px-2.5 text-xs text-foreground" value={filter.status} onChange={e => setFilter({ ...filter, status: e.target.value })}>
          <option value="all">All Status</option><option value="open">Open</option><option value="closed">Closed</option>
        </select>
        <select className="h-8 rounded-md border border-border bg-input px-2.5 text-xs text-foreground" value={filter.type} onChange={e => setFilter({ ...filter, type: e.target.value })}>
          <option value="all">All Types</option><option value="swing">Swing</option><option value="position">Position</option><option value="etf">ETF</option>
        </select>
        <select className="h-8 rounded-md border border-border bg-input px-2.5 text-xs text-foreground" value={filter.setup} onChange={e => setFilter({ ...filter, setup: e.target.value })}>
          <option value="all">All Setups</option>
          {SETUPS.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
        </select>
        <select className="h-8 rounded-md border border-border bg-input px-2.5 text-xs text-foreground" value={`${sort.field}-${sort.dir}`} onChange={e => { const [field, dir] = e.target.value.split("-"); setSort({ field, dir }); }}>
          <option value="date-desc">Newest First</option><option value="date-asc">Oldest First</option>
          <option value="pnl-desc">P&L High→Low</option><option value="pnl-asc">P&L Low→High</option>
          <option value="rr-desc">R:R High→Low</option><option value="rr-asc">R:R Low→High</option>
          <option value="ticker-asc">Ticker A→Z</option><option value="ticker-desc">Ticker Z→A</option>
        </select>
        {(filter.search || filter.status !== "all" || filter.type !== "all" || filter.setup !== "all") && (
          <Button variant="outline" size="sm" onClick={() => setFilter({ search: "", status: "all", type: "all", setup: "all" })} className="h-8 text-[10px]">CLEAR</Button>
        )}
        <span className="text-[10px] text-muted-foreground ml-auto">{filtered.length} of {trades.length} trades</span>
      </div>

      {/* New Trade Form */}
      {show && (
        <Card className="mb-5">
          <CardContent className="p-5">
            <div className="text-xs text-primary tracking-wider uppercase mb-4 font-medium">◆ New Trade Entry</div>
            <div className="grid grid-cols-[repeat(auto-fit,minmax(140px,1fr))] gap-3">
              <div><label className="text-[10px] text-muted-foreground block mb-1">TICKER</label><Input value={f.ticker} onChange={e => setF({...f, ticker: e.target.value})} placeholder="AAPL" /></div>
              <div><label className="text-[10px] text-muted-foreground block mb-1">ENTRY PRICE</label><Input type="number" step="0.01" value={f.entry} onChange={e => setF({...f, entry: e.target.value})} placeholder="150.00" /></div>
              <div><label className="text-[10px] text-muted-foreground block mb-1">SHARES</label><Input type="number" value={f.shares} onChange={e => setF({...f, shares: e.target.value})} placeholder="50" /></div>
              <div><label className="text-[10px] text-muted-foreground block mb-1">STOP LOSS</label><Input type="number" step="0.01" value={f.stop} onChange={e => setF({...f, stop: e.target.value})} placeholder="147.00" /></div>
              <div><label className="text-[10px] text-muted-foreground block mb-1">TARGET</label><Input type="number" step="0.01" value={f.target} onChange={e => setF({...f, target: e.target.value})} placeholder="156.00" /></div>
              <div><label className="text-[10px] text-muted-foreground block mb-1">DATE</label><Input type="date" value={f.date} onChange={e => setF({...f, date: e.target.value})} /></div>
              <div><label className="text-[10px] text-muted-foreground block mb-1">TYPE</label>
                <select className="w-full h-9 rounded-md border border-border bg-input px-3 text-sm text-foreground" value={f.type} onChange={e => setF({...f, type: e.target.value})}><option value="swing">Swing</option><option value="position">Position</option><option value="etf">ETF</option></select>
              </div>
              <div><label className="text-[10px] text-muted-foreground block mb-1">SETUP (Rule E4)</label>
                <select className="w-full h-9 rounded-md border border-border bg-input px-3 text-sm text-foreground" value={f.setup} onChange={e => setF({...f, setup: e.target.value})}>
                  {SETUPS.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                </select>
              </div>
            </div>
            <div className="mt-3">
              <label className="text-[10px] text-muted-foreground block mb-1">THESIS — Why entering? (Rule E6)</label>
              <textarea className="w-full min-h-[60px] rounded-md border border-border bg-input px-3 py-2 text-sm text-foreground resize-y focus:border-ring focus:outline-none" value={f.thesis} onChange={e => setF({...f, thesis: e.target.value})} placeholder="Breakout above resistance on high volume. SPY above 50MA." />
            </div>
            {f.entry && f.stop && f.shares && (() => {
              const e = parseFloat(f.entry), s = parseFloat(f.stop), sh = parseInt(f.shares), tg = parseFloat(f.target);
              const rps = Math.abs(e-s), risk = rps*sh, pos = e*sh, rr = tg ? (tg-e)/rps : 0;
              return (
                <div className="bg-accent rounded-lg p-3.5 mt-3.5">
                  <div className="text-[10px] text-muted-foreground mb-2 tracking-wider">PRE-TRADE CHECK</div>
                  <div className="flex flex-wrap gap-4 text-xs">
                    <span className={cn("font-semibold", risk <= maxR ? "text-profit" : "text-loss")}>{risk <= maxR ? "✓" : "✗"} Risk: {fUSD(risk)} (max {fUSD(maxR)})</span>
                    <span className={cn("font-semibold", pos <= maxP ? "text-profit" : "text-loss")}>{pos <= maxP ? "✓" : "✗"} Size: {fUSD(pos)} (max {fUSD(maxP)})</span>
                    {tg > 0 && <span className={cn("font-semibold", rr >= 2 ? "text-profit" : "text-loss")}>{rr >= 2 ? "✓" : "✗"} R:R: {fmt(rr,1)}:1 (min 2:1)</span>}
                  </div>
                </div>
              );
            })()}
            <Button onClick={add} className="mt-3.5 font-bold text-xs">LOG TRADE</Button>
          </CardContent>
        </Card>
      )}

      {/* Trade List */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <div className="text-3xl mb-3">◎</div>
          <div>{trades.length === 0 ? "No trades logged yet." : "No trades match filters."}</div>
        </div>
      ) : filtered.map(t => (
        <Card key={t.id} className={cn("mb-2", t.status === "open" ? "border-info/30" : (t.pnl||0) >= 0 ? "border-profit/30" : "border-loss/30")}>
          <CardContent className="p-4">
            <div className="flex justify-between items-start flex-wrap gap-2">
              <div className="flex items-center gap-2.5">
                <span className={cn("font-bold text-base", t.status === "open" ? "text-info" : (t.pnl||0) >= 0 ? "text-profit" : "text-loss")}>{t.ticker}</span>
                <Badge variant="outline" className={cn("text-[10px] font-semibold border-0",
                  t.status === "open" ? "bg-info-muted text-info" : (t.pnl||0) >= 0 ? "bg-profit-muted text-profit" : "bg-loss-muted text-loss"
                )}>{t.status === "open" ? "OPEN" : (t.pnl||0) >= 0 ? "WIN" : "LOSS"}</Badge>
                {t.setup && <Badge variant="outline" className="text-[10px] font-semibold border-0 bg-primary/15 text-primary">{setupLabel(t.setup)}</Badge>}
                <span className="text-[10px] text-muted-foreground uppercase">{t.type}</span>
              </div>
              <div className="flex gap-1.5">
                {t.status === "open" && cfId !== t.id && (
                  <Button variant="outline" size="sm" onClick={() => startClose(t.id)} className="h-7 text-[10px] font-semibold bg-warn-muted text-warn border-warn/30 hover:bg-warn-muted/80">CLOSE TRADE</Button>
                )}
                {t.status === "closed" && editJournalId !== t.id && (
                  <Button variant="outline" size="sm" onClick={() => startEditJournal(t)} className="h-7 text-[10px] font-semibold">
                    {t.journalLessons || t.journalMistakes ? "EDIT JOURNAL" : "+ JOURNAL"}
                  </Button>
                )}
                <Button variant="outline" size="sm" onClick={() => deleteTrade(t.id)} className="h-7 text-[10px] px-2">✗</Button>
              </div>
            </div>
            <div className="flex flex-wrap gap-4 mt-2.5 text-xs text-muted-foreground">
              <span>Entry: <strong className="text-foreground">{fUSD(t.entry)}</strong></span>
              <span>{t.shares} shares</span>
              <span>Stop: <strong className="text-loss">{fUSD(t.stop)}</strong></span>
              <span>Target: <strong className="text-profit">{fUSD(t.target)}</strong></span>
              <span>Risk: <strong className="text-warn">{fUSD(t.totalRisk)}</strong></span>
              <span>R:R: <strong className={t.rr >= 2 ? "text-profit" : "text-loss"}>{fmt(t.rr,1)}:1</strong></span>
              {t.status === "closed" && <span>P&L: <strong className={(t.pnl||0) >= 0 ? "text-profit" : "text-loss"}>{fUSD(t.pnl)}</strong></span>}
            </div>
            {t.thesis && <div className="text-xs text-muted-foreground mt-2 italic border-l-2 border-border pl-2.5">{t.thesis}</div>}

            {/* Close Trade form (inline expand) */}
            {cfId === t.id && (
              <div className="mt-3 p-3.5 bg-accent rounded-lg border border-warn/20 space-y-3">
                <div className="text-[10px] text-warn tracking-wider font-semibold uppercase">◉ Closing Trade — Journal Required</div>
                <div className="grid grid-cols-[140px_1fr] gap-3 items-end">
                  <div>
                    <label className="text-[10px] text-muted-foreground block mb-1">CLOSE PRICE</label>
                    <Input type="number" step="0.01" placeholder="0.00" value={closeForm.price}
                      onChange={e => setCloseForm({ ...closeForm, price: e.target.value })} className="h-9" autoFocus />
                  </div>
                  <div>
                    <label className="text-[10px] text-muted-foreground block mb-1">EMOTION DURING TRADE</label>
                    <select className="w-full h-9 rounded-md border border-border bg-input px-3 text-sm text-foreground"
                      value={closeForm.emotion} onChange={e => setCloseForm({ ...closeForm, emotion: e.target.value })}>
                      <option value="">— select —</option>
                      <option value="calm">Calm / disciplined</option>
                      <option value="confident">Confident</option>
                      <option value="anxious">Anxious / nervous</option>
                      <option value="fomo">FOMO / chasing</option>
                      <option value="revenge">Revenge / angry</option>
                      <option value="bored">Bored / forced</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground block mb-1">WHAT WENT RIGHT? (lessons / what to repeat)</label>
                  <textarea className="w-full min-h-[60px] rounded-md border border-border bg-input px-3 py-2 text-sm text-foreground resize-y focus:border-ring focus:outline-none"
                    value={closeForm.lessons} onChange={e => setCloseForm({ ...closeForm, lessons: e.target.value })}
                    placeholder="Followed the system, took profit at 2R, kept stop tight..." />
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground block mb-1">WHAT WENT WRONG? (mistakes / what to avoid)</label>
                  <textarea className="w-full min-h-[60px] rounded-md border border-border bg-input px-3 py-2 text-sm text-foreground resize-y focus:border-ring focus:outline-none"
                    value={closeForm.mistakes} onChange={e => setCloseForm({ ...closeForm, mistakes: e.target.value })}
                    placeholder="Entered too early, ignored low volume, moved stop..." />
                </div>
                <div className="flex items-center gap-2">
                  <input type="checkbox" id={`fr-${t.id}`} checked={closeForm.followedRules}
                    onChange={e => setCloseForm({ ...closeForm, followedRules: e.target.checked })}
                    className="h-4 w-4 rounded border-border" />
                  <label htmlFor={`fr-${t.id}`} className="text-xs text-foreground cursor-pointer">I followed all system rules on this trade</label>
                </div>
                <div className="flex gap-2 justify-end">
                  <Button variant="outline" size="sm" onClick={() => setCfId(null)} className="text-xs">CANCEL</Button>
                  <Button size="sm" onClick={() => close(t.id)} disabled={!closeForm.price} className="text-xs font-bold">CLOSE TRADE</Button>
                </div>
              </div>
            )}

            {/* Journal display (closed trades, not editing) */}
            {t.status === "closed" && editJournalId !== t.id && (t.journalLessons || t.journalMistakes || t.emotion) && (
              <div className="mt-3 p-3 bg-accent/50 rounded-lg border border-border space-y-2">
                <div className="flex items-center gap-2 text-[10px] tracking-wider uppercase font-semibold">
                  <span className="text-muted-foreground">◆ Journal</span>
                  {t.followedRules === true && <span className="text-profit">✓ Followed Rules</span>}
                  {t.followedRules === false && <span className="text-loss">✗ Broke Rules</span>}
                  {t.emotion && <span className="text-info">{t.emotion}</span>}
                </div>
                {t.journalLessons && <div className="text-xs text-foreground"><span className="text-profit font-semibold">Right:</span> {t.journalLessons}</div>}
                {t.journalMistakes && <div className="text-xs text-foreground"><span className="text-loss font-semibold">Wrong:</span> {t.journalMistakes}</div>}
              </div>
            )}

            {/* Journal edit form */}
            {editJournalId === t.id && (
              <div className="mt-3 p-3.5 bg-accent rounded-lg border border-border space-y-3">
                <div className="text-[10px] text-muted-foreground tracking-wider font-semibold uppercase">◆ Edit Journal</div>
                <div>
                  <label className="text-[10px] text-muted-foreground block mb-1">EMOTION DURING TRADE</label>
                  <select className="w-full h-9 rounded-md border border-border bg-input px-3 text-sm text-foreground"
                    value={journalForm.emotion} onChange={e => setJournalForm({ ...journalForm, emotion: e.target.value })}>
                    <option value="">— select —</option>
                    <option value="calm">Calm / disciplined</option>
                    <option value="confident">Confident</option>
                    <option value="anxious">Anxious / nervous</option>
                    <option value="fomo">FOMO / chasing</option>
                    <option value="revenge">Revenge / angry</option>
                    <option value="bored">Bored / forced</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground block mb-1">WHAT WENT RIGHT?</label>
                  <textarea className="w-full min-h-[60px] rounded-md border border-border bg-input px-3 py-2 text-sm text-foreground resize-y focus:border-ring focus:outline-none"
                    value={journalForm.lessons} onChange={e => setJournalForm({ ...journalForm, lessons: e.target.value })} />
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground block mb-1">WHAT WENT WRONG?</label>
                  <textarea className="w-full min-h-[60px] rounded-md border border-border bg-input px-3 py-2 text-sm text-foreground resize-y focus:border-ring focus:outline-none"
                    value={journalForm.mistakes} onChange={e => setJournalForm({ ...journalForm, mistakes: e.target.value })} />
                </div>
                <div className="flex items-center gap-2">
                  <input type="checkbox" id={`fr-edit-${t.id}`} checked={journalForm.followedRules}
                    onChange={e => setJournalForm({ ...journalForm, followedRules: e.target.checked })}
                    className="h-4 w-4 rounded border-border" />
                  <label htmlFor={`fr-edit-${t.id}`} className="text-xs text-foreground cursor-pointer">I followed all system rules on this trade</label>
                </div>
                <div className="flex gap-2 justify-end">
                  <Button variant="outline" size="sm" onClick={() => setEditJournalId(null)} className="text-xs">CANCEL</Button>
                  <Button size="sm" onClick={() => saveJournal(t.id)} className="text-xs font-bold">SAVE JOURNAL</Button>
                </div>
              </div>
            )}

            <div className="text-[10px] text-muted-foreground/70 mt-1.5">{t.date}{t.closeDate ? ` → ${t.closeDate}` : ""}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
