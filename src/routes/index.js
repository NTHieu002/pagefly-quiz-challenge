const express = require('express');
const { getQuestionForClient, getFirstQuestionId, totalQuestions, questionIndex } = require('../lib/questions');
const { startOrGet, hasCompleted, setDiscount, getDiscount } = require('../lib/quiz-state');
const { matchVariant, defaultDiscount } = require('../lib/discount');

const router = express.Router();

const SHOP_HANDLE = /^[a-z0-9][a-z0-9-]{0,59}$/;

// The store handle normally arrives as ?shop=, but the app launcher sometimes
// nests a second `?sid=airbusses.myshopify.com` inside the first sid, which
// Express folds into the sid value. Fall back to pulling the handle out of the
// raw URL so either shape resolves to `airbusses`.
function resolveShopHandle(req) {
  const explicit = String(req.query.shop || '').trim().toLowerCase().replace(/\.myshopify\.com$/, '');
  if (explicit) return SHOP_HANDLE.test(explicit) ? explicit : null;

  const match = /([a-z0-9][a-z0-9-]{0,59})\.myshopify\.com/i.exec(req.originalUrl || '');
  return match ? match[1].toLowerCase() : null;
}

function buildShopifyPricingUrl(handle) {
  if (!handle) return null;
  return `https://admin.shopify.com/store/${handle}/apps/pagefly/pricing`;
}

router.get('/', (req, res) => {
  const sid = (req.query.sid || '').toString().trim();
  const shopifyPricingUrl = buildShopifyPricingUrl(resolveShopHandle(req));
  // The raw ?code= as it arrived. Distinct from the discount code the winner
  // sees — this is the campaign token the rating webhook is keyed on.
  const urlCode = (req.query.code || '').toString().trim();

  if (!sid) {
    return res.status(400).render('error', {
      message: 'Invalid access. Please open the quiz from inside the PageFly app.',
    });
  }

  // Bind the reward variant from ?code= to this sid. A known variant wins
  // (latest entry); a missing/unknown code never clobbers a prior choice. Once
  // completed the reward is frozen, so a later ?code= can't swap what was earned.
  const variant = matchVariant(req.query.code);
  if (variant && !hasCompleted(sid)) setDiscount(sid, variant);
  const discount = getDiscount(sid) || defaultDiscount();

  // Some rewards (e.g. u1m) override where the post-claim button sends the user.
  const rewardRedirectUrl = discount.redirectUrl || null;

  if (hasCompleted(sid)) {
    return res.render('quiz', {
      sid,
      total: totalQuestions(),
      firstQuestion: null,
      firstIndex: 0,
      alreadyClaimed: true,
      discountCode: discount.code,
      discountLabel: discount.label,
      shopifyPricingUrl,
      urlCode,
      rewardRedirectUrl,
    });
  }

  const currentId = startOrGet(sid);
  const firstQuestion = getQuestionForClient(currentId);

  res.render('quiz', {
    sid,
    total: totalQuestions(),
    firstQuestion,
    firstIndex: questionIndex(currentId),
    alreadyClaimed: false,
    discountCode: '',
    discountLabel: discount.label,
    shopifyPricingUrl,
    urlCode,
    rewardRedirectUrl,
  });
});

module.exports = router;
