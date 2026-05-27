const express = require('express');
const {
  checkAnswer,
  getQuestionForClient,
  getFirstQuestionId,
  isLastQuestion,
  questionIndex,
  totalQuestions,
} = require('../lib/questions');
const {
  getCurrent,
  startOrGet,
  advance,
  reset,
  markCompleted,
  hasCompleted,
  getDiscount,
} = require('../lib/quiz-state');
const { defaultDiscount } = require('../lib/discount');
const { fireQuizComplete } = require('../lib/webhook');

const router = express.Router();

router.post('/answer', (req, res) => {
  const { sid, questionId, selectedIndex } = req.body || {};

  if (!sid || typeof sid !== 'string') {
    return res.status(400).json({ error: 'Missing sid.' });
  }
  if (!Number.isInteger(questionId) || !Number.isInteger(selectedIndex)) {
    return res.status(400).json({ error: 'Invalid payload.' });
  }

  if (hasCompleted(sid)) {
    const discount = getDiscount(sid) || defaultDiscount();
    return res.status(409).json({
      error: 'Quiz already completed for this session.',
      alreadyClaimed: true,
      discountCode: discount.code,
      discountLabel: discount.label,
    });
  }

  let expected = getCurrent(sid);
  if (expected === undefined && questionId === getFirstQuestionId()) {
    expected = startOrGet(sid);
  }
  if (expected === undefined || expected !== questionId) {
    return res.status(400).json({ error: 'Question out of order.' });
  }

  const correct = checkAnswer(questionId, selectedIndex);

  if (!correct) {
    reset(sid);
    return res.json({
      correct: false,
      nextQuestionId: null,
      completed: false,
      nextQuestion: null,
      nextIndex: null,
      total: totalQuestions(),
    });
  }

  if (isLastQuestion(questionId)) {
    markCompleted(sid);
    advance(sid, questionId);
    const discount = getDiscount(sid) || defaultDiscount();
    fireQuizComplete({ sid, discountCode: discount.code });
    return res.json({
      correct: true,
      nextQuestionId: null,
      completed: true,
      discountCode: discount.code,
      discountLabel: discount.label,
      total: totalQuestions(),
    });
  }

  const nextId = advance(sid, questionId);
  return res.json({
    correct: true,
    nextQuestionId: nextId,
    completed: false,
    nextQuestion: getQuestionForClient(nextId),
    nextIndex: questionIndex(nextId),
    total: totalQuestions(),
  });
});

module.exports = router;
