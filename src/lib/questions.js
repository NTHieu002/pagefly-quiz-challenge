const fs = require('fs');
const path = require('path');

const questionsPath = path.join(__dirname, '..', '..', 'questions.json');
const questions = JSON.parse(fs.readFileSync(questionsPath, 'utf8'));

const byId = new Map(questions.map((q) => [q.id, q]));
const orderedIds = questions.map((q) => q.id);

function sanitize(q) {
  return { id: q.id, question: q.question, options: q.options };
}

function getQuestionForClient(id) {
  const q = byId.get(id);
  return q ? sanitize(q) : null;
}

function getFirstQuestionId() {
  return orderedIds[0];
}

function getNextQuestionId(currentId) {
  const idx = orderedIds.indexOf(currentId);
  if (idx === -1 || idx === orderedIds.length - 1) return null;
  return orderedIds[idx + 1];
}

function isLastQuestion(id) {
  return orderedIds.indexOf(id) === orderedIds.length - 1;
}

function checkAnswer(questionId, selectedIndex) {
  const q = byId.get(questionId);
  if (!q) return false;
  return Number(selectedIndex) === q.correctIndex;
}

function totalQuestions() {
  return orderedIds.length;
}

function questionIndex(id) {
  return orderedIds.indexOf(id);
}

module.exports = {
  getQuestionForClient,
  getFirstQuestionId,
  getNextQuestionId,
  isLastQuestion,
  checkAnswer,
  totalQuestions,
  questionIndex,
};
