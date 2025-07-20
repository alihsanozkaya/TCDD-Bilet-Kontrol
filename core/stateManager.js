const userState = new Map();
const inProgressUsers = new Set();
const activeCheckers = new Set();

function startProgress(chatId) {
  inProgressUsers.add(chatId);
}

function clearUserState(chatId) {
  inProgressUsers.delete(chatId);
  userState.delete(chatId);
}

function isInProgress(chatId) {
  return inProgressUsers.has(chatId);
}

function startChecker(chatId) {
  activeCheckers.add(chatId);
}

function stopChecker(chatId) {
  activeCheckers.delete(chatId);
}

function isChecking(chatId) {
  return activeCheckers.has(chatId);
}

function setState(chatId, state) {
  userState.set(chatId, state);
}

function getState(chatId) {
  return userState.get(chatId);
}

function deleteState(chatId) {
  userState.delete(chatId);
}

module.exports = {
  startProgress,
  clearUserState,
  isInProgress,
  startChecker,
  stopChecker,
  isChecking,
  setState,
  getState,
  deleteState
};
