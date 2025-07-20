const TelegramBot = require("node-telegram-bot-api");
const ticketChecker = require("../core/ticketChecker");
const { validStations, stationListText } = require("../data/stations");

function startTelegramBot() {
  const bot = new TelegramBot(process.env.TELEGRAM_TOKEN, { polling: true });

  const userState = {};
  const activeCheckers = new Map();

  bot.onText(/\/biletbul/, async (msg) => {
    const chatId = msg.chat.id;

    if (activeCheckers.get(chatId)) {
      await bot.sendMessage(
        chatId,
        "Zaten bir kontrol çalışıyor. Önce /durdur ile durdurabilirsiniz."
      );
      return;
    }

    userState[chatId] = { step: "from" };
    await bot.sendMessage(
      chatId,
      "Kalkış istasyon kodunu girin:\n" + stationListText()
    );
  });

  bot.onText(/\/durdur/, async (msg) => {
    const chatId = msg.chat.id;

    const isLoopActive = activeCheckers.get(chatId) === true;
    const isInProgress = !!userState[chatId];

    if (isLoopActive) {
      await bot.sendMessage(chatId, "🛑 Sefer kontrolü durduruluyor...");
      ticketChecker.stopCheckingLoop(chatId);
      activeCheckers.set(chatId, false);
      delete userState[chatId];
      await bot.sendMessage(chatId, "✅ Kontrol durduruldu.");
      return;
    }

    if (isInProgress) {
      delete userState[chatId];
      await bot.sendMessage(
        chatId,
        "🛑 İşlem iptal edildi. Sefer seçimi yapılmamıştı."
      );
      return;
    }

    await bot.sendMessage(chatId, "⚠️ Aktif bir işlem bulunamadı.");
  });

  bot.on("message", async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text ? msg.text.trim() : "";

    if (!userState[chatId] || text.startsWith("/")) return;

    const state = userState[chatId];

    try {
      if (state.step === "from") {
        if (!validStations[text]) {
          await bot.sendMessage(
            chatId,
            "Geçersiz kalkış kodu. Tekrar deneyin."
          );
          return;
        }
        state.from = text;
        state.step = "to";
        await bot.sendMessage(
          chatId,
          "Varış istasyon kodunu girin:\n" + stationListText()
        );
      } else if (state.step === "to") {
        if (!validStations[text]) {
          await bot.sendMessage(chatId, "Geçersiz varış kodu. Tekrar deneyin.");
          return;
        }
        state.to = text;
        state.step = "date";
        await bot.sendMessage(chatId, "Tarih girin (gg aa yyyy):");
      } else if (state.step === "date") {
        if (!/^\d{2} \d{2} \d{4}$/.test(text)) {
          await bot.sendMessage(
            chatId,
            'Geçersiz tarih formatı. "gg aa yyyy" şeklinde girin. Örn: 15 07 2025'
          );
          return;
        }

        const [day, month, year] = text.split(" ").map(Number);
        const inputDate = new Date(year, month - 1, day);
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        if (inputDate < today) {
          await bot.sendMessage(
            chatId,
            "⚠️ Geçmiş tarih seçilemez. Lütfen bugünden sonraki bir tarih girin."
          );
          return;
        }

        const currentMonth = today.getMonth();
        const currentYear = today.getFullYear();

        let maxMonth = currentMonth + 2;
        let maxYear = currentYear;

        if (maxMonth > 11) {
          maxMonth = maxMonth % 12;
          maxYear += 1;
        }

        const maxDate = new Date(maxYear, maxMonth, 0);

        if (inputDate > maxDate) {
          const maxDay = maxDate.getDate();
          const maxMonthDisplay = (maxDate.getMonth() + 1)
            .toString()
            .padStart(2, "0");
          const maxYearDisplay = maxDate.getFullYear();
          await bot.sendMessage(
            chatId,
            `⚠️ Maksimum tarih ${maxDay} ${maxMonthDisplay} ${maxYearDisplay} olabilir.`
          );
          return;
        }

        state.date = text;

        await bot.sendMessage(
          chatId,
          `✅ Bilgiler alındı:\nKalkış: ${validStations[state.from]}\nVarış: ${
            validStations[state.to]
          }\nTarih: ${state.date}\n\nSeferler listeleniyor...`
        );

        const expeditionList = await ticketChecker.getExpeditionList(
          state.from,
          state.to,
          state.date
        );
        if (expeditionList.length === 0) {
          await bot.sendMessage(
            chatId,
            "⚠️ Bu tarih ve güzergah için sefer bulunamadı."
          );
          delete userState[chatId];
          await ticketChecker.closeListBrowser();
          return;
        }

        let replyText = "📅 Sefer listesinden seçim yapınız:\n\n";

        expeditionList.forEach((ex, i) => {
          const lines = ex.text
            .split("\n")
            .map((line) => line.trim())
            .filter(Boolean);

          const trainLine = lines[0] || "🚄 Tren Bilgisi Bulunamadı";
          const departureStation = lines[2] || "Kalkış ?";
          const duration = lines[3] || "Süre ?";
          const arrivalStation = lines[4] || "Varış ?";
          const departureTime = lines[5] || "Kalkış Saati ?";
          const arrivalTime = lines[6] || "Varış Saati ?";
          const priceLine = lines.find((line) => line.includes("₺")) || "₺ ???";
          const availableSeatMatch = ex.text.match(/\((\d+)\)$/);
          const availableSeats = availableSeatMatch
            ? availableSeatMatch[1]
            : "?";

          const emoji = trainLine.startsWith("YHT")
            ? "🚅"
            : trainLine.startsWith("ANAHAT")
            ? "🚞"
            : "🚄";

          replyText += `${i + 1}. ${emoji} ${trainLine}\n`;
          replyText += `  🚉 ${departureStation} → ${arrivalStation}\n`;
          replyText += `  🕕 ${departureTime} - ${arrivalTime} (${duration})\n`;
          replyText += `  💺 Boş Koltuk: ${availableSeats}\n`;
          replyText += `  💰 ${priceLine}\n\n`;
        });

        state.expeditionList = expeditionList;
        state.step = "expedition";

        await bot.sendMessage(
          chatId,
          replyText + "✏️ Lütfen seçmek istediğiniz seferin numarasını yazınız:"
        );
      } else if (state.step === "expedition") {
        const idx = parseInt(text);
        if (
          isNaN(idx) ||
          idx < 1 ||
          idx > (state.expeditionList || []).length
        ) {
          await bot.sendMessage(
            chatId,
            "Geçersiz sefer numarası. Tekrar deneyin."
          );
          return;
        }

        const selectedExpedition = state.expeditionList[idx - 1];

        const lines = selectedExpedition.text
          .split("\n")
          .map((line) => line.trim())
          .filter(Boolean);

        const trainLine = lines[0] || "🚄 Tren Bilgisi Bulunamadı";
        const departureStation = lines[2] || "Kalkış ?";
        const duration = lines[3] || "Süre ?";
        const arrivalStation = lines[4] || "Varış ?";
        const departureTime = lines[5] || "Kalkış Saati ?";
        const arrivalTime = lines[6] || "Varış Saati ?";
        const date = lines[7] || "Tarih ?";
        const priceLine = lines.find((line) => line.includes("₺")) || "₺ ???";
        const availableSeatMatch = selectedExpedition.text.match(/\((\d+)\)$/);
        const availableSeats = availableSeatMatch ? availableSeatMatch[1] : "?";

        const emoji = trainLine.startsWith("YHT")
          ? "🚅"
          : trainLine.startsWith("ANAHAT")
          ? "🚞"
          : "🚄";

        const replyText = `
✅ Seçilen Sefer:

${emoji} ${trainLine}

  🚉 ${departureStation} → ${arrivalStation}
  🕕 ${departureTime} - ${arrivalTime} (${duration})
  📅 ${date}
  💺 Boş Koltuk: ${availableSeats}
  💰 ${priceLine}

📡 Kontrol başlatılıyor...
`;

        await bot.sendMessage(chatId, replyText.trim());

        activeCheckers.set(chatId, true);
        delete userState[chatId];

        await ticketChecker.closeListBrowser();

        ticketChecker.startCheckingLoop(
          state.from,
          state.to,
          state.date,
          selectedExpedition.id,
          {
            onFound: async (msg) => {
              await bot.sendMessage(chatId, msg);
              activeCheckers.set(chatId, false);
            },
            onCheck: async (msg) => {
              await bot.sendMessage(chatId, msg);
            },
            onError: async (err) => {
              console.error(err);
              await bot.sendMessage(
                chatId,
                "❗ Kontrol sırasında hata oluştu."
              );
              activeCheckers.set(chatId, false);
            },
          },
          chatId // 👈 burası önemli
        );
      }
    } catch (e) {
      console.error(e);
      await bot.sendMessage(
        chatId,
        "❗ Bir hata oluştu, lütfen tekrar deneyin."
      );
      delete userState[chatId];
      activeCheckers.set(chatId, false);
    }
  });

  return bot;
}

module.exports = { startTelegramBot };
