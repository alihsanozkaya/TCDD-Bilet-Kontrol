const { Client, NoAuth } = require("whatsapp-web.js");
const qrcode = require("qrcode-terminal");
const { startCheckingLoop } = require("../core/ticketChecker");

function startWhatsAppBot() {
  const client = new Client({
    authStrategy: new NoAuth(),
  });

  client.on("qr", (qr) => {
    console.log("📱 WhatsApp QR kodunu telefonla okut:");
    qrcode.generate(qr, { small: true });
  });

  client.on("ready", async () => {
    console.log("✅ WhatsApp bağlantısı kuruldu.");

    const expeditionId = "gidis1btn";
    const from = "566";
    const to = "93";
    const date = "11 08 2025";

    const targetNumber = process.env.TARGET_WHATSAPP_NUMBER;

    await startCheckingLoop(from, to, date, expeditionId, {
      onFound: async (msg) => {
        console.log("🚨 Bilet bulundu, WhatsApp'a mesaj atılıyor...");
        await client.sendMessage(targetNumber, msg);
      }
    });
  });

  client.on("auth_failure", (msg) => {
    console.error("❌ WhatsApp kimlik doğrulama hatası:", msg);
  });

  client.on("disconnected", (reason) => {
    console.log("🔌 WhatsApp bağlantısı kesildi:", reason);
  });

  client.initialize();
}

module.exports = { startWhatsAppBot };
