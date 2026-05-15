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
} = require('../lib/quiz-state');
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
    return res.status(409).json({
      error: 'Quiz already completed for this session.',
      alreadyClaimed: true,
      discountCode: process.env.DISCOUNT_CODE || '',
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
    const discountCode = process.env.DISCOUNT_CODE || '';
    fireQuizComplete({ sid, discountCode });
    return res.json({
      correct: true,
      nextQuestionId: null,
      completed: true,
      discountCode,
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
