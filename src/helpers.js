export const fmt = (n, d = 2) => (n == null || isNaN(n)) ? "—" : Number(n).toFixed(d);
export const fUSD = (n) => (n == null || isNaN(n)) ? "—" : `$${Number(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
export const fPct = (n) => (n == null || isNaN(n)) ? "—" : `${n >= 0 ? "+" : ""}${Number(n).toFixed(2)}%`;
export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
export const td = () => new Date().toISOString().split("T")[0];

export const DEFAULT_SETTINGS = { capital: 10000, maxRiskPct: 1, maxPositions: 3, maxPosPct: 20 };

// Convert DB snake_case row to app camelCase
export const rowToTrade = (r) => ({
  id: r.id, ticker: r.ticker, entry: Number(r.entry), stop: Number(r.stop), target: r.target ? Number(r.target) : null,
  shares: r.shares, thesis: r.thesis, date: r.date, type: r.type, status: r.status,
  riskPerShare: Number(r.risk_per_share), totalRisk: Number(r.total_risk), positionSize: Number(r.position_size),
  rr: Number(r.rr), closeDate: r.close_date, closePrice: r.close_price ? Number(r.close_price) : null, pnl: r.pnl ? Number(r.pnl) : null,
  journalLessons: r.journal_lessons || "", journalMistakes: r.journal_mistakes || "",
  followedRules: r.followed_rules, emotion: r.emotion || "",
});
export const tradeToRow = (t, userId) => ({
  id: t.id, user_id: userId, ticker: t.ticker, entry: t.entry, stop: t.stop, target: t.target,
  shares: t.shares, thesis: t.thesis, date: t.date, type: t.type, status: t.status,
  risk_per_share: t.riskPerShare, total_risk: t.totalRisk, position_size: t.positionSize,
  rr: t.rr, close_date: t.closeDate, close_price: t.closePrice, pnl: t.pnl,
  journal_lessons: t.journalLessons || null, journal_mistakes: t.journalMistakes || null,
  followed_rules: t.followedRules ?? null, emotion: t.emotion || null,
});
export const rowToWL = (r) => ({
  id: r.id, ticker: r.ticker, notes: r.notes, setup: r.setup, alert: r.alert ? Number(r.alert) : null, date: r.date, status: r.status,
});
export const wlToRow = (w, userId) => ({
  id: w.id, user_id: userId, ticker: w.ticker, notes: w.notes, setup: w.setup, alert: w.alert, date: w.date, status: w.status,
});
export const rowToSettings = (r) => r ? { capital: Number(r.capital), maxRiskPct: Number(r.max_risk_pct), maxPositions: r.max_positions, maxPosPct: Number(r.max_pos_pct) } : DEFAULT_SETTINGS;
export const settingsToRow = (s, userId) => ({ user_id: userId, capital: s.capital, max_risk_pct: s.maxRiskPct, max_positions: s.maxPositions, max_pos_pct: s.maxPosPct });
