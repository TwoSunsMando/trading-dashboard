import { useEffect, useMemo, useState, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { tb } from "@/lib/tradingBot";
import { fmt } from "../helpers";


export default function Hunter({ toast, navigateToBot }) {
  const [watchlist, setWatchlist] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hunting, setHunting] = useState(false);

  // Hunt-now form
  const [assetClass, setAssetClass] = useState("both");
  const [userPrompt, setUserPrompt] = useState("");
  const [showPromptInput, setShowPromptInput] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [w, h] = await Promise.all([
        tb.watchlist().catch(() => null),
        tb.huntHistory(10).catch(() => ({ hunts: [] })),
      ]);
      setWatchlist(w);
      setHistory(h?.hunts || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const runHunt = async () => {
    setHunting(true);
    try {
      const result = await tb.hunt({
        asset_class: assetClass,
        user_prompt: userPrompt.trim() || undefined,
        limit: 10,
      });
      toast?.(`Hunt complete — ${result.items?.length ?? 0} picks in ${result.duration_seconds}s`);
      // Reload from server so watchlist + history are in sync.
      await refresh();
    } catch (e) {
      toast?.(`Hunt failed: ${e.message}`, "error");
    } finally {
      setHunting(false);
    }
  };

  // Click-through: dispatch the user to the right Bot tab with the
  // symbol pre-selected. The CryptoBot/StocksBot tabs already do
  // research auto-fill via their selected-symbol state, so we just
  // need to switch tabs and set the selected symbol.
  const goResearch = (item) => {
    if (!item?.symbol || !item?.asset_class) return;
    if (typeof navigateToBot === "function") {
      navigateToBot(item.asset_class, item.symbol);
    } else {
      // Fallback for cases where the parent didn't wire navigateToBot:
      // copy the symbol to clipboard and tell the user to paste it.
      navigator.clipboard?.writeText(item.symbol);
      toast?.(`Symbol ${item.symbol} copied — paste into ${item.asset_class === "crypto" ? "Crypto Bot" : "Stocks Bot"}`);
    }
  };

  const items = watchlist?.items || [];
  const ranAt = watchlist?.ran_at;
  const ranAtRel = useMemo(() => relativeAge(ranAt), [ranAt]);

  return (
    <div>
      <div className="flex items-center justify-between mb-1 flex-wrap gap-2">
        <h1 className="text-2xl font-bold">🎯 Watchlist Hunter</h1>
        <div className="flex items-center gap-2">
          {watchlist?.asset_class && (
            <Badge variant="outline" className="text-[10px]">
              {watchlist.asset_class.toUpperCase()}
            </Badge>
          )}
          {ranAt && <Badge variant="secondary" className="text-[10px]">last hunt: {ranAtRel}</Badge>}
        </div>
      </div>
      <p className="text-muted-foreground text-xs mb-6">
        Top-of-funnel AI scan. Hunter ranks the universe; click a pick to research → analyze → execute.
      </p>

      {/* Hunt now controls */}
      <Card className="mb-6">
        <CardContent className="p-5">
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <div className="text-xs text-muted-foreground tracking-wider uppercase">Run a hunt</div>
            <div className="flex gap-1">
              {["both", "stocks", "crypto"].map((a) => (
                <button key={a} onClick={() => setAssetClass(a)}
                  className={cn(
                    "px-3 py-1 rounded-md text-xs font-bold tracking-wider uppercase",
                    assetClass === a ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground border border-border",
                  )}>
                  {a}
                </button>
              ))}
            </div>
          </div>

          {showPromptInput && (
            <div className="mb-3">
              <div className="text-[10px] text-muted-foreground mb-1">
                Optional focus prompt — Hunter biases toward what you ask
              </div>
              <textarea
                value={userPrompt}
                onChange={(e) => setUserPrompt(e.target.value)}
                rows={2}
                placeholder="e.g. AI sector plays this week, or crypto setups breaking out, or pullbacks to 50-day MA on liquid names"
                className="w-full bg-background border border-border rounded-md p-3 text-sm focus:border-primary outline-none"
              />
            </div>
          )}

          <div className="flex gap-2 flex-wrap">
            <Button onClick={runHunt} disabled={hunting} className="text-xs font-bold">
              {hunting ? "HUNTING..." : "🎯 HUNT NOW"}
            </Button>
            <Button onClick={() => setShowPromptInput((v) => !v)} variant="outline" className="text-xs">
              {showPromptInput ? "Hide prompt" : "+ Add prompt"}
            </Button>
            <Button onClick={refresh} disabled={loading} variant="outline" className="text-xs">
              {loading ? "Loading..." : "Refresh"}
            </Button>
          </div>

          <p className="text-[10px] text-muted-foreground italic mt-3">
            Manual hunts debounce 5 min apart to keep token spend bounded. Daily Coolify schedule (when wired) will run independently.
          </p>
        </CardContent>
      </Card>

      {/* Summary blurb */}
      {watchlist?.summary && (
        <Card className="mb-6">
          <CardContent className="p-5">
            <div className="text-xs text-muted-foreground tracking-wider uppercase mb-2">Hunter overview</div>
            <p className="text-sm">{watchlist.summary}</p>
            {watchlist.user_prompt && (
              <p className="text-[11px] text-muted-foreground italic mt-2">
                Focused on: <span className="text-foreground">{watchlist.user_prompt}</span>
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Top picks grid */}
      <div className="text-xs text-muted-foreground tracking-wider uppercase mb-3">Top picks</div>
      {items.length === 0 ? (
        <Card className="mb-6">
          <CardContent className="p-5 text-xs text-muted-foreground">
            No watchlist yet. Click 🎯 HUNT NOW above to run one.
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
          {items.map((item, idx) => (
            <Card key={item.id || `${item.symbol}-${idx}`} className="hover:border-primary/40 transition-colors">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2 gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground text-xs font-bold w-5">#{(item.rank ?? idx + 1)}</span>
                    <span className="text-base font-bold">{item.symbol}</span>
                    <Badge variant={item.asset_class === "crypto" ? "secondary" : "outline"} className="text-[9px]">
                      {item.asset_class}
                    </Badge>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    score <span className="text-foreground font-bold">{fmt(item.score, 2)}</span>
                  </span>
                </div>
                <p className="text-xs mb-3">{item.why}</p>
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex flex-wrap gap-1">
                    {(item.tags || []).map((t) => (
                      <span key={t} className="text-[10px] bg-accent text-accent-foreground px-2 py-0.5 rounded">
                        {t}
                      </span>
                    ))}
                  </div>
                  <Button size="sm" onClick={() => goResearch(item)} className="h-7 text-[10px] font-bold">
                    🔍 RESEARCH →
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* History */}
      {history.length > 0 && (
        <Card className="mb-6">
          <CardContent className="p-5">
            <div className="text-xs text-muted-foreground tracking-wider uppercase mb-3">Recent hunts</div>
            <div className="space-y-1.5">
              {history.map((h) => (
                <div key={h.id} className="flex items-center justify-between text-xs gap-3">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <span className="text-muted-foreground text-[10px] w-32 shrink-0">
                      {new Date(h.ran_at).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </span>
                    <Badge variant="outline" className="text-[9px]">{h.asset_class}</Badge>
                    <span className="text-muted-foreground truncate">
                      {h.user_prompt ? `"${h.user_prompt}"` : <em>(default scan)</em>}
                    </span>
                  </div>
                  <span className="text-muted-foreground text-[10px]">{h.duration_seconds}s · {h.summaries_collected} symbols</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}


function relativeAge(iso) {
  if (!iso) return "—";
  const t = new Date(iso).getTime();
  const diff = (Date.now() - t) / 1000;
  if (diff < 60) return `${Math.round(diff)}s ago`;
  if (diff < 3600) return `${Math.round(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.round(diff / 3600)}h ago`;
  return `${Math.round(diff / 86400)}d ago`;
}
