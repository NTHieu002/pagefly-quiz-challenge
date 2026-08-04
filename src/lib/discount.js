// Optional `?code=` reward variants.
// No param (or an unknown value) → the default 20% reward.
// Codes are not secret (every winner sees them), so the literals are safe
// fallbacks here, while env vars allow per-environment overrides.
//
// The default reward changed from 15% to 20% along with its code. Any box whose
// env still pins the retired DISCOUNT_CODE_DEFAULT=263PLO15-M7P (or the even
// older DISCOUNT_CODE) silently outranks the literal below and keeps handing out
// 15% — update the deployed .env, don't rely on this fallback alone.
const DEFAULT_REWARD = { env: 'DISCOUNT_CODE_DEFAULT', fallback: '263PLO20-Q2X', label: '20% off' };

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
