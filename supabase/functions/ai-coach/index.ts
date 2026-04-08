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
    const { messages, portfolio } = await req.json();

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
        contextBlock += `\n\n## RECENT CLOSED TRADES (with journal entries)
${portfolio.closedTrades.map((t: any) => {
  const lines = [`- ${t.ticker} (${t.type}): P&L $${t.pnl?.toFixed(2)}, R:R ${t.rr?.toFixed(1)}:1, closed ${t.closeDate}`];
  if (t.followedRules === false) lines.push(`  ⚠ BROKE RULES`);
  if (t.emotion) lines.push(`  Emotion: ${t.emotion}`);
  if (t.lessons) lines.push(`  Right: ${t.lessons}`);
  if (t.mistakes) lines.push(`  Wrong: ${t.mistakes}`);
  return lines.join("\n");
}).join("\n")}

When the user asks about patterns, mistakes, or how to improve, USE THIS DATA. Look for repeated emotions, broken rules, common mistakes — be specific and reference actual trades.`;
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
        system: SYSTEM_PROMPT + contextBlock,
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
