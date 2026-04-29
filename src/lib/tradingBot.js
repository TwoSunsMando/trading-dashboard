// Client for the trading-bot FastAPI service. Browser-side wrapper —
// every call goes to the backend, which is the only thing that holds
// Coinbase credentials. The dashboard never talks to Coinbase directly.
//
// Configured via VITE_TRADING_BOT_URL. Defaults to localhost:8765 for
// dev. In production set it to e.g. https://api.trading.astridagent.ai.

const BASE = import.meta.env.VITE_TRADING_BOT_URL || "http://localhost:8765";

async function req(path, opts = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...(opts.headers || {}) },
    ...opts,
  });
  const text = await res.text();
  let body;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  if (!res.ok) {
    const detail = (body && body.detail) || body || res.statusText;
    const err = new Error(typeof detail === "string" ? detail : JSON.stringify(detail));
    err.status = res.status;
    err.body = body;
    throw err;
  }
  return body;
}

export const tb = {
  // ----- Health & mode -----
  health:   () => req("/trading/health"),
  mode:     () => req("/trading/mode"),
  setMode:  (target, confirm) => req("/trading/mode", { method: "POST", body: JSON.stringify({ target, confirm }) }),

  // ----- Market data -----
  price:    (productId) => req(`/trading/prices/${encodeURIComponent(productId)}`),
  prices:   (productIds) => req(`/trading/prices?products=${productIds.join(",")}`),
  candles:  (productId, granularity = "1h", limit = 100) =>
              req(`/trading/candles/${encodeURIComponent(productId)}?granularity=${granularity}&limit=${limit}`),

  // ----- Account -----
  balances: () => req("/trading/balances"),
  accountState: () => req("/trading/account-state"),
  history:  (limit = 50, mode = null) =>
              req(`/trading/history?limit=${limit}${mode ? `&mode=${mode}` : ""}`),
  killSwitch: () => req("/trading/kill-switch"),
  setKillSwitch: (enabled, reason = null) =>
              req("/trading/kill-switch", { method: "POST", body: JSON.stringify({ enabled, reason }) }),

  // ----- Orders -----
  listOrders: (limit = 50) => req(`/trading/orders?limit=${limit}`),
  placeOrder: (payload) => req("/trading/orders", { method: "POST", body: JSON.stringify(payload) }),

  // ----- Claude analysis -----
  analyze:  (payload) => req("/trading/analyze", { method: "POST", body: JSON.stringify(payload) }),

  // ----- Claude scout: proposes entry/stop/target/thesis from candles -----
  research: (payload) => req("/trading/research", { method: "POST", body: JSON.stringify(payload) }),

  // ----- Rules Workshop -----
  listRules:        (marketType = null) =>
                      req(`/trading/rules${marketType ? `?market_type=${marketType}` : ""}`),
  activeRulesAll:   () => req("/trading/rules/active"),
  activeRules:      (marketType) => req(`/trading/rules/active/${marketType}`),
  createRulesVersion: (payload) =>
                      req("/trading/rules", { method: "POST", body: JSON.stringify(payload) }),
  activateRulesVersion: (versionId) =>
                      req(`/trading/rules/${versionId}/activate`, { method: "POST" }),
  reviewRules:      (marketType, analysesLimit = 20) =>
                      req("/trading/rules/review", {
                        method: "POST",
                        body: JSON.stringify({ market_type: marketType, analyses_limit: analysesLimit }),
                      }),
};

// Default product universe — matches the build prompt + paper_balances seed.
export const PRODUCTS = ["BTC-USD", "ETH-USD", "SOL-USD", "AVAX-USD", "LINK-USD", "DOGE-USD"];
