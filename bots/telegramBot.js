const TelegramBot = require("node-telegram-bot-api");
const ticketChecker = require("../core/ticketChecker");
const formatter = require("../utils/formatter");
const stateManager = require("../core/stateManager");
const { validStations, stationListText } = require("../data/stations");

function startTelegramBot() {
  const bot = new TelegramBot(process.env.TELEGRAM_TOKEN, { polling: true });

  bot.onText(/\/biletbul/, async (msg) => {
    const chatId = msg.chat.id;

    if (stateManager.isChecking(chatId) || stateManager.isInProgress(chatId)) {
      await bot.sendMessage(
        chatId,
        "Zaten bir işlem veya kontrol çalışıyor. Önce /durdur ile durdurabilirsiniz."
      );
      return;
    }

    stateManager.startProgress(chatId);
    stateManager.setState(chatId, { step: "from" });

    await bot.sendMessage(
      chatId,
      "Kalkış istasyon kodunu girin:\n" + stationListText()
    );
  });

  bot.onText(/\/durdur/, async (msg) => {
    const chatId = msg.chat.id;

    if (stateManager.isChecking(chatId)) {
      await bot.sendMessage(chatId, "🛑 Sefer kontrolü durduruluyor...");
      ticketChecker.stopCheckingLoop(chatId);
      stateManager.clearUserState(chatId);
      stateManager.stopChecker(chatId);
      stateManager.deleteState(chatId);
      await bot.sendMessage(chatId, "✅ Kontrol durduruldu.");
      return;
    }

    if (stateManager.isInProgress(chatId)) {
      ticketChecker.setStopFlag(chatId);
      stateManager.clearUserState(chatId);
      stateManager.deleteState(chatId);
      await bot.sendMessage(chatId, "🛑 İşlem iptal edildi.");
      return;
    }

    await bot.sendMessage(chatId, "⚠️ Aktif bir işlem bulunamadı.");
  });

  bot.on("message", async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text ? msg.text.trim() : "";

    if (!stateManager.getState(chatId) || text.startsWith("/")) return;

    const state = stateManager.getState(chatId);

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
        stateManager.setState(chatId, state);
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
        stateManager.setState(chatId, state);
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

        let maxMonth = today.getMonth() + 2;
        let maxYear = today.getFullYear();

        if (maxMonth > 11) {
          maxMonth %= 12;
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
        stateManager.setState(chatId, state);

        await bot.sendMessage(
          chatId,
          `✅ Bilgiler alındı:\nKalkış: ${validStations[state.from]}\nVarış: ${
            validStations[state.to]
          }\nTarih: ${state.date}\n\nSeferler listeleniyor...`
        );

        const expeditionList = await ticketChecker.getExpeditionList(
          state.from,
          state.to,
          state.date,
          chatId
        );

        if (!expeditionList) {
          stateManager.deleteState(chatId);
          return;
        }

        if (expeditionList.length === 0) {
          await bot.sendMessage(
            chatId,
            "⚠️ Bu tarih ve güzergah için sefer bulunamadı."
          );
          stateManager.deleteState(chatId);
          await ticketChecker.closeListBrowser();
          return;
        }

        let replyText = "📅 Sefer listesinden seçim yapınız:\n\n";
        replyText += expeditionList
          .map((exp, i) => formatter.formatExpeditionListItem(exp, i))
          .join("\n");

        state.expeditionList = expeditionList;
        state.step = "expedition";
        stateManager.setState(chatId, state);

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

        await bot.sendMessage(
          chatId,
          formatter.formatSelectedExpedition(selectedExpedition)
        );

        stateManager.startChecker(chatId);
        stateManager.deleteState(chatId);

        await ticketChecker.closeListBrowser();

        ticketChecker.startCheckingLoop(
          state.from,
          state.to,
          state.date,
          selectedExpedition.id,
          {
            onFound: async (msg) => {
              await bot.sendMessage(chatId, msg);
              stateManager.stopChecker(chatId);
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
              stateManager.stopChecker(chatId);
            },
          },
          chatId
        );
      }
    } catch (e) {
      console.error(e);
      await bot.sendMessage(
        chatId,
        "❗ Bir hata oluştu, lütfen tekrar deneyin."
      );
      stateManager.deleteState(chatId);
      stateManager.stopChecker(chatId);
    }
  });

  return bot;
}

module.exports = { startTelegramBot };
