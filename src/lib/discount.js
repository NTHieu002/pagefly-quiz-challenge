// Optional `?code=` reward variants.
// No param (or an unknown value) → the default 20% reward from DISCOUNT_CODE.
// Codes are not secret (every winner sees them), so the literals are safe
// fallbacks here, while env vars allow per-environment overrides.
const VARIANTS = {
  '30': { env: 'DISCOUNT_CODE_30', fallback: 'PF_GROW30', label: '30% off' },
  u1m: { env: 'DISCOUNT_CODE_U1M', fallback: 'PF_YUO5CQQ2', label: '1 month unlimited' },
};

// Returns { code, label } for a known variant, or null for missing/unknown.
function matchVariant(codeParam) {
  const key = String(codeParam || '').trim().toLowerCase();
  const v = VARIANTS[key];
  if (!v) return null;
  return { code: process.env[v.env] || v.fallback, label: v.label };
}

function defaultDiscount() {
  return { code: process.env.DISCOUNT_CODE || '', label: '20% off' };
}

module.exports = { matchVariant, defaultDiscount };
