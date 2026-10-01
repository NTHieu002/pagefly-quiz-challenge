// Optional `?code=` reward variants.
// No param (or an unknown value) → the default 20% reward.
// Codes are not secret (every winner sees them), so they live as literals here.
//
// The default reward is deliberately NOT env-overridable. `.env` is gitignored,
// so a value set on the deployed box outlives every code change and silently
// keeps handing out a retired code — that happened twice (PF_START20, then
// 263PLO15-M7P) and each time the fix was to rename the env var to something
// production wasn't setting. Editing the constant below and deploying is the
// whole change: no `.env` edit, no ssh.
const DEFAULT_REWARD = { code: '264LOGAN20Y-R8M', label: '20% off' };

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
    code: DEFAULT_REWARD.code,
    label: DEFAULT_REWARD.label,
    redirectUrl: null,
  };
}

module.exports = { matchVariant, defaultDiscount };
