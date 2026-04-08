import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");

const SYSTEM_PROMPT = `You are the Steiner Trading Coach — a disciplined, no-nonsense trading mentor built into the Steiner Trading Terminal. You know the user's complete trading system and enforce it strictly.

## YOUR TRADING SYSTEM: Steiner Swing System v1.0

**Philosophy:** "Singles, not home runs. Protect capital. Let winners run. Cut losers fast."

### Risk Management Rules
- R1: Never risk more than 1% of total capital per trade
- R2: Maximum 3 open positions at once
- R3: Never invest more than 20% of capital in one position
- R4: Stop trading after 3 consecutive losses — step back and review
- R5: Weekly max loss: 3% of capital. Hit it? Done until Monday.
- R6: No revenge trading — ever.

### Entry Rules
- E1: Only trade stocks above the 50-day moving average
- E2: Volume must be above average on entry day/week
- E3: Minimum 2:1 reward-to-risk ratio required
- E4: Entry triggers: breakout, bounce off support, or pullback to MA
- E5: Check sector/market trend (SPY/QQQ) before entry
- E6: Write thesis BEFORE entering — if you can't explain why, skip it

### Exit Rules
- X1: Set stop loss IMMEDIATELY at entry
- X2: Trail stop to breakeven after +1R gain
- X3: Take 50% profit at 2R, let rest ride with trailing stop
- X4: Hard exit if stock closes below 50-day MA
- X5: Max hold time: 6 weeks for swing trades
- X6: Never turn a swing trade into an "investment"

### Weekly Routine
- Saturday: Weekly review — log all trades, calculate P&L, update watchlist
- Sunday: Scan for setups — check charts on watchlist, set alerts
- Mon-Fri AM (7-9): Pre-market — check news, gaps, volume. Execute planned entries ONLY
- Mon-Fri PM (5-6): After close — review positions, update stops, journal. 15 min max.

### ETF Playbook
- SPY: Core trend-following. Buy pullbacks to 21 EMA in uptrends.
- QQQ: Tech momentum. Higher beta = tighter stops.
- IWM: Small cap rotation. Buy range breakouts.
- XLF: Financials. Strong when rates rise.
- XLE: Energy. Follow oil.
- GLD: Gold. Hedge / fear trade. Buy when market weakens.
- TLT: 20+ Yr Treasuries. Flight to safety.

## YOUR ROLE

1. **Explain technical analysis** in plain English when asked. Reference what indicators mean for trade decisions per the system rules.
2. **Coach through pre-trade checklists** — walk through E1-E6 before any entry.
3. **Warn about rule violations** — if the user's portfolio data shows they're at max positions, consecutive losses, or weekly loss limit, say so clearly.
4. **Guide the weekly routine** — help with Saturday reviews, Sunday scans, and daily routines.
5. **Be direct and concise** — you're a coach, not a professor. Short, actionable responses. Use the rule IDs (R1, E3, X2, etc.) when referencing rules.
6. **Never give specific buy/sell recommendations** — you coach the process, not the picks. Help them evaluate setups against THEIR system.

When the user provides portfolio context (capital, open positions, P&L, etc.), factor it into your coaching. For example, if they have 3 open positions and want to enter a new trade, remind them of R2.`;

// Fetch 1y of daily candles from Yahoo Finance and compute key technicals
async function fetchMarketData(ticker: string) {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=1y`;
    const res = await fetch(url, {
      headers: {
        // Yahoo blocks bare requests without a UA
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    });
    if (!res.ok) return { error: `Yahoo Finance returned ${res.status}` };
    const data = await res.json();
    const result = data?.chart?.result?.[0];
    if (!result) return { error: "No data returned" };

    const closes: number[] = result.indicators?.quote?.[0]?.close?.filter((v: number | null) => v != null) ?? [];
    const volumes: number[] = result.indicators?.quote?.[0]?.volume?.filter((v: number | null) => v != null) ?? [];
    const highs: number[] = result.indicators?.quote?.[0]?.high?.filter((v: number | null) => v != null) ?? [];
    const lows: number[] = result.indicators?.quote?.[0]?.low?.filter((v: number | null) => v != null) ?? [];
    if (!closes.length) return { error: "No price data" };

    const last = (arr: number[], n: number) => arr.slice(-n);
    const avg = (arr: number[]) => arr.reduce((s, v) => s + v, 0) / arr.length;
    const max = (arr: number[]) => Math.max(...arr);
    const min = (arr: number[]) => Math.min(...arr);

    const price = closes[closes.length - 1];
    const prevClose = closes[closes.length - 2] ?? price;
    const dayChangePct = ((price - prevClose) / prevClose) * 100;

    const sma50 = closes.length >= 50 ? avg(last(closes, 50)) : null;
    const sma200 = closes.length >= 200 ? avg(last(closes, 200)) : null;

    const todayVol = volumes[volumes.length - 1];
    const avgVol30 = volumes.length >= 30 ? avg(last(volumes, 30)) : null;
    const volRatio = avgVol30 ? todayVol / avgVol30 : null;

    const high52 = max(closes);
    const low52 = min(closes);
    const distFromHigh = ((price - high52) / high52) * 100;
    const distFromLow = ((price - low52) / low52) * 100;

    // Last 10 days of recent action for trend feel
    const recent = last(closes, 10).map(v => v.toFixed(2)).join(", ");
    const recentVols = last(volumes, 10).map(v => Math.round(v / 1000) + "k").join(", ");

    return {
      price: +price.toFixed(2),
      dayChangePct: +dayChangePct.toFixed(2),
      sma50: sma50 ? +sma50.toFixed(2) : null,
      sma200: sma200 ? +sma200.toFixed(2) : null,
      aboveSma50: sma50 ? price > sma50 : null,
      aboveSma200: sma200 ? price > sma200 : null,
      pctAboveSma50: sma50 ? +(((price - sma50) / sma50) * 100).toFixed(2) : null,
      todayVol,
      avgVol30,
      volRatio: volRatio ? +volRatio.toFixed(2) : null,
      volAboveAvg: volRatio ? volRatio > 1.0 : null,
      high52: +high52.toFixed(2),
      low52: +low52.toFixed(2),
      distFromHigh: +distFromHigh.toFixed(2),
      distFromLow: +distFromLow.toFixed(2),
      recent10Closes: recent,
      recent10Volumes: recentVols,
      dayHigh: highs.length ? +highs[highs.length - 1].toFixed(2) : null,
      dayLow: lows.length ? +lows[lows.length - 1].toFixed(2) : null,
    };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405 });
  }

  if (!ANTHROPIC_API_KEY) {
    return new Response(JSON.stringify({ error: "ANTHROPIC_API_KEY not configured" }), { status: 500 });
  }

  try {
    const { messages, portfolio, chartTicker } = await req.json();

    // If a chart ticker is provided, fetch live market data and append to context
    let chartBlock = "";
    if (chartTicker && typeof chartTicker === "string") {
      const md = await fetchMarketData(chartTicker.toUpperCase().trim());
      if ((md as any).error) {
        chartBlock = `\n\n## CHART CONTEXT
The user is currently looking at a chart for ${chartTicker.toUpperCase()}, but I couldn't fetch market data: ${(md as any).error}`;
      } else {
        const m = md as any;
        const checks: string[] = [];
        if (m.aboveSma50 != null) checks.push(`E1 (above 50MA): ${m.aboveSma50 ? "✓ PASS" : "✗ FAIL"} — price $${m.price} vs 50MA $${m.sma50} (${m.pctAboveSma50 > 0 ? "+" : ""}${m.pctAboveSma50}%)`);
        if (m.volAboveAvg != null) checks.push(`E2 (above-avg volume): ${m.volAboveAvg ? "✓ PASS" : "✗ FAIL"} — today's volume is ${m.volRatio}x the 30-day average`);

        chartBlock = `\n\n## CHART CONTEXT — User is analyzing ${chartTicker.toUpperCase()}
- Current price: $${m.price} (${m.dayChangePct > 0 ? "+" : ""}${m.dayChangePct}% today)
- Day range: $${m.dayLow} – $${m.dayHigh}
- 50-day MA: $${m.sma50 ?? "N/A"} (${m.aboveSma50 ? "ABOVE" : "BELOW"})
- 200-day MA: $${m.sma200 ?? "N/A"} (${m.aboveSma200 ? "ABOVE" : "BELOW"})
- Today's volume vs 30-day avg: ${m.volRatio ? `${m.volRatio}x` : "N/A"} ${m.volAboveAvg ? "(above average)" : "(below average)"}
- 52-week range: $${m.low52} – $${m.high52}
- Distance from 52w high: ${m.distFromHigh}%
- Distance from 52w low: +${m.distFromLow}%
- Last 10 closes: ${m.recent10Closes}
- Last 10 volumes: ${m.recent10Volumes}

## SYSTEM RULE CHECKS FOR ${chartTicker.toUpperCase()}
${checks.join("\n")}

When the user asks about this chart, USE THIS DATA. Reference specific numbers. Tell them whether this stock currently passes the entry rules (E1, E2) per the Steiner system. Be direct — is this a valid setup or not? What setup type would it be (breakout, pullback, bounce)? What would the stop and target look like?`;
      }
    }

    // Build context message from portfolio data if provided
    let contextBlock = "";
    if (portfolio) {
      contextBlock = `\n\n## CURRENT PORTFOLIO STATE
- Capital: $${portfolio.capital?.toLocaleString() ?? "N/A"} (started: $${portfolio.startCapital?.toLocaleString() ?? "N/A"})
- Total P&L: $${portfolio.totalPnL?.toFixed(2) ?? "N/A"}
- Win Rate: ${portfolio.winRate?.toFixed(1) ?? "N/A"}%
- Open Positions: ${portfolio.openCount ?? 0} / ${portfolio.maxPositions ?? 3} max
- Week P&L: $${portfolio.wkPnL?.toFixed(2) ?? "N/A"}
- Consecutive Losses: ${portfolio.consLoss ?? 0}
- Open Trades: ${portfolio.openTrades?.map((t: any) => `${t.ticker} (${t.shares} shares @ $${t.entry}, stop $${t.stop}, target $${t.target})`).join("; ") || "None"}`;

      if (portfolio.closedTrades?.length) {
        // Aggregate by setup type for quick win-rate stats
        const bySetup: Record<string, { wins: number; losses: number; pnl: number }> = {};
        for (const t of portfolio.closedTrades) {
          const key = t.setup || "untagged";
          if (!bySetup[key]) bySetup[key] = { wins: 0, losses: 0, pnl: 0 };
          if ((t.pnl ?? 0) >= 0) bySetup[key].wins++; else bySetup[key].losses++;
          bySetup[key].pnl += t.pnl ?? 0;
        }
        const setupStats = Object.entries(bySetup).map(([setup, s]) => {
          const total = s.wins + s.losses;
          const wr = total ? ((s.wins / total) * 100).toFixed(0) : "0";
          return `  • ${setup}: ${s.wins}W/${s.losses}L (${wr}% win rate, $${s.pnl.toFixed(2)} total P&L)`;
        }).join("\n");

        contextBlock += `\n\n## SETUP PERFORMANCE BREAKDOWN
${setupStats}

## RECENT CLOSED TRADES (with journal entries)
${portfolio.closedTrades.map((t: any) => {
  const lines = [`- ${t.ticker} (${t.type}${t.setup ? `, ${t.setup}` : ""}): P&L $${t.pnl?.toFixed(2)}, R:R ${t.rr?.toFixed(1)}:1, closed ${t.closeDate}`];
  if (t.followedRules === false) lines.push(`  ⚠ BROKE RULES`);
  if (t.emotion) lines.push(`  Emotion: ${t.emotion}`);
  if (t.lessons) lines.push(`  Right: ${t.lessons}`);
  if (t.mistakes) lines.push(`  Wrong: ${t.mistakes}`);
  return lines.join("\n");
}).join("\n")}

When the user asks about patterns, mistakes, edge, or how to improve, USE THIS DATA. The SETUP PERFORMANCE BREAKDOWN shows which setup types are working — reference it directly. Look for repeated emotions, broken rules, common mistakes — be specific and reference actual trades.`;
      }
    }

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1024,
        system: SYSTEM_PROMPT + contextBlock + chartBlock,
        messages: messages.slice(-20), // Keep last 20 messages for context
      }),
    });

    if (!response.ok) {
      const errBody = await response.text();
      return new Response(JSON.stringify({ error: `Anthropic API error: ${response.status}`, details: errBody }), {
        status: 502,
        headers: { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const text = data.content?.[0]?.text ?? "No response";

    return new Response(JSON.stringify({ response: text }), {
      headers: { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" },
    });
  }
});
