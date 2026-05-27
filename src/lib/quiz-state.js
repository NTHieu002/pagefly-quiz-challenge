const { getFirstQuestionId, getNextQuestionId } = require('./questions');

const currentBySid = new Map();
const completedSids = new Set();
const discountBySid = new Map();

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

// Reward variant chosen at entry (via ?code=), bound to the sid so the API
// completion can't be tampered into a different reward by the client.
function setDiscount(sid, discount) {
  discountBySid.set(sid, discount);
}

function getDiscount(sid) {
  return discountBySid.get(sid);
}

module.exports = {
  startOrGet,
  getCurrent,
  advance,
  reset,
  markCompleted,
  hasCompleted,
  setDiscount,
  getDiscount,
};
