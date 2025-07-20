require("dotenv").config();

const { startTelegramBot } = require("./bots/telegramBot");
const { startWhatsAppBot } = require("./bots/whatsappBot");

const selectedBot = process.env.BOT_PLATFORM;

if (selectedBot === "telegram") {
  startTelegramBot();
} else if (selectedBot === "whatsapp") {
  startWhatsAppBot();
} else {
  console.log("Hatalı BOT_PLATFORM! .env dosyanızda 'telegram' veya 'whatsapp' yazmalısınız.");
}
