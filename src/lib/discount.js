// Optional `?code=` reward variants.
// No param (or an unknown value) → the default 15% reward from DISCOUNT_CODE.
// Codes are not secret (every winner sees them), so the literals are safe
// fallbacks here, while env vars allow per-environment overrides.
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
  return { code: process.env.DISCOUNT_CODE || '', label: '15% off', redirectUrl: null };
}

module.exports = { matchVariant, defaultDiscount };
