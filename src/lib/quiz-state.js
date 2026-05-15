const { getFirstQuestionId, getNextQuestionId } = require('./questions');

const currentBySid = new Map();
const completedSids = new Set();

function startOrGet(sid) {
  if (!currentBySid.has(sid)) {
    currentBySid.set(sid, getFirstQuestionId());
  }
  return currentBySid.get(sid);
}

function getCurrent(sid) {
  return currentBySid.get(sid);
}

function advance(sid, currentId) {
  const next = getNextQuestionId(currentId);
  if (next === null) {
    currentBySid.delete(sid);
  } else {
    currentBySid.set(sid, next);
  }
  return next;
}

function reset(sid) {
  currentBySid.delete(sid);
}

function markCompleted(sid) {
  completedSids.add(sid);
}

function hasCompleted(sid) {
  return completedSids.has(sid);
}

module.exports = {
  startOrGet,
  getCurrent,
  advance,
  reset,
  markCompleted,
  hasCompleted,
};
