const express = require('express');
const { getQuestionForClient, getFirstQuestionId, totalQuestions, questionIndex } = require('../lib/questions');
const { startOrGet, hasCompleted } = require('../lib/quiz-state');

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

  if (hasCompleted(sid)) {
    return res.render('quiz', {
      sid,
      total: totalQuestions(),
      firstQuestion: null,
      firstIndex: 0,
      alreadyClaimed: true,
      discountCode: process.env.DISCOUNT_CODE || '',
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
    shopifyAdminUrl,
  });
});

module.exports = router;
