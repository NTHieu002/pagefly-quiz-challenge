const express = require('express');
const { getQuestionForClient, getFirstQuestionId, totalQuestions, questionIndex } = require('../lib/questions');
const { startOrGet, hasCompleted, setDiscount, getDiscount } = require('../lib/quiz-state');
const { matchVariant, defaultDiscount } = require('../lib/discount');

const router = express.Router();

function buildShopifyAdminUrl(rawShop) {
  if (!rawShop) return null;
  const cleaned = String(rawShop).trim().toLowerCase().replace(/\.myshopify\.com$/, '');
  if (!/^[a-z0-9][a-z0-9-]{0,59}$/.test(cleaned)) return null;
  return `https://admin.shopify.com/store/${cleaned}/apps/pagefly`;
}

router.get('/', (req, res) => {
  const sid = (req.query.sid || '').toString().trim();
  const shopifyAdminUrl = buildShopifyAdminUrl(req.query.shop);

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

  if (hasCompleted(sid)) {
    return res.render('quiz', {
      sid,
      total: totalQuestions(),
      firstQuestion: null,
      firstIndex: 0,
      alreadyClaimed: true,
      discountCode: discount.code,
      discountLabel: discount.label,
      shopifyAdminUrl,
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
    shopifyAdminUrl,
  });
});

module.exports = router;
