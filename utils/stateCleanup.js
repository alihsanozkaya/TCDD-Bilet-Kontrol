const ticketChecker = require("../core/ticketChecker");
const stateManager = require("../utils/stateManager");

function cleanUpAfterCheck(chatId) {
  ticketChecker.stopCheckingLoop(chatId);
  stateManager.stopChecker(chatId);
  stateManager.clearUserState(chatId);
  stateManager.deleteState(chatId);
}

module.exports = { cleanUpAfterCheck };
