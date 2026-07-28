// Optional `?code=` reward variants.
// No param (or an unknown value) → the default 15% reward.
// Codes are not secret (every winner sees them), so the literals are safe
// fallbacks here, while env vars allow per-environment overrides.
//
// The default reward reads DISCOUNT_CODE_DEFAULT, not the older DISCOUNT_CODE.
// The reward changed from 20% to 15% along with its code, and deployed boxes
// still carry the retired 20% value under the old name — an env var set on the
// server would silently outrank the literal below and hand out the wrong code.
const DEFAULT_REWARD = { env: 'DISCOUNT_CODE_DEFAULT', fallback: '263PLO15-M7P', label: '15% off' };

const VARIANTS = {
  '30': { env: 'DISCOUNT_CODE_30', fallback: 'PF_GROW30', label: '30% off' },
  u1m: {
    env: 'DISCOUNT_CODE_U1M',
    fallback: 'PF_YUO5CQQ2',
    label: '1 month unlimited',
    // Override the post-claim redirect for this reward: send winners to the
    // PageFly listing on the Shopify App Store instead of back to the app.
    redirectUrl: 'https://apps.shopify.com/pagefly',
  },
};

// Returns { code, label, redirectUrl? } for a known variant, or null for missing/unknown.
function matchVariant(codeParam) {
  const key = String(codeParam || '').trim().toLowerCase();
  const v = VARIANTS[key];
  if (!v) return null;
  return { code: process.env[v.env] || v.fallback, label: v.label, redirectUrl: v.redirectUrl || null };
}

function defaultDiscount() {
  return {
    code: process.env[DEFAULT_REWARD.env] || DEFAULT_REWARD.fallback,
    label: DEFAULT_REWARD.label,
    redirectUrl: null,
  };
}

module.exports = { matchVariant, defaultDiscount };
