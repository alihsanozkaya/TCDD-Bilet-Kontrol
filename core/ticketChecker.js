const { chromium } = require("playwright");

let browser = null;
let page = null;
const stopCheckingFlags = new Map();
const stopProgressFlags = new Map();

async function launchBrowser() {
  if (!browser) {
    browser = await chromium.launch({ headless: false, args: ["--start-maximized"] });
    const context = await browser.newContext({ viewport: null });
    page = await context.newPage();
  }
}

async function closeBrowser() {
  if (browser) {
    await browser.close();
    browser = null;
    page = null;
  }
}

function shouldStop(chatId) {
  return stopProgressFlags.get(chatId);
}

async function clickWithCheck(selector, chatId, timeout = 1000) {
  if (shouldStop(chatId)) return false;
  await page.waitForSelector(selector, { timeout });
  await page.click(selector);
  await page.waitForTimeout(500);
  return true;
}

async function getExpeditionList(from, to, date, chatId) {
  stopProgressFlags.set(chatId, false);
  await launchBrowser();
  await page.goto("https://ebilet.tcddtasimacilik.gov.tr/", { waitUntil: "load" });

  const actions = [
    () => clickWithCheck("#fromTrainInput", chatId),
    () => clickWithCheck(`#gidis-${from}`, chatId),
    () => clickWithCheck("#toTrainInput", chatId),
    () => clickWithCheck(`#donus-${to}`, chatId),
    () => clickWithCheck(".departureDate", chatId),
    () => clickWithCheck(`[id="${date}"]`, chatId),
    () => clickWithCheck("#searchSeferButton", chatId),
  ];

  for (const action of actions) {
    const result = await action();
    if (!result) {
      await closeBrowser();
      return null;
    }
  }

  await page.waitForTimeout(5000);

  if (shouldStop(chatId)) {
    await closeBrowser();
    return null;
  }

  await page.waitForSelector(".seferInformationArea", { timeout: 15000 });

  const expeditionButtons = await page.$$(`button[id^="gidis"][id$="btn"]`);
  const expeditionList = [];

  for (const btn of expeditionButtons) {
    const id = await btn.getAttribute("id");
    const text = await btn.innerText();
    expeditionList.push({ id, text });
  }

  return expeditionList;
}

async function closeListBrowser() {
  await closeBrowser();
}

async function checkSelectedExpedition(from, to, date, expeditionId) {
  const browserLocal = await chromium.launch({ headless: false, args: ["--start-maximized"] });
  const context = await browserLocal.newContext({ viewport: null });
  const pageLocal = await context.newPage();

  try {
    await pageLocal.goto("https://ebilet.tcddtasimacilik.gov.tr/", { waitUntil: "load" });

    const steps = [
      "#fromTrainInput", `#gidis-${from}`,
      "#toTrainInput", `#donus-${to}`,
      ".departureDate", `[id="${date}"]`,
      "#searchSeferButton"
    ];

    for (const selector of steps) {
      await pageLocal.waitForSelector(selector, { timeout: 1000 });
      await pageLocal.click(selector);
      await pageLocal.waitForTimeout(500);
    }

    await pageLocal.waitForSelector(".seferInformationArea", { timeout: 15000 });
    await pageLocal.click(`#${expeditionId}`);
    await pageLocal.waitForTimeout(1000);

    const buttons = await pageLocal.$$(
      `#collapseBody${expeditionId.replace("btn", "")} button[id^="sefer-"][id$="-departure"]`
    );

    for (const button of buttons) {
      const text = await button.innerText();
      if (text.includes("EKONOMİ") && !text.includes("DOLU")) {
        return true;
      }
    }

    return false;
  } catch (err) {
    console.error("Sefer kontrolünde hata:", err);
    return false;
  } finally {
    await browserLocal.close();
  }
}

async function startCheckingLoop(from, to, date, expeditionId, callbacks = {}, chatId) {
  stopCheckingFlags.set(chatId, false);
  let informedDolu = false;

  try {
    while (!stopCheckingFlags.get(chatId)) {
      const empty = await checkSelectedExpedition(from, to, date, expeditionId);
      if (stopCheckingFlags.get(chatId)) break;

      if (empty) {
        if (callbacks.onFound) await callbacks.onFound("🚨 Boş yer açıldı! Hemen kontrol et.");
        break;
      } else if (!informedDolu) {
        informedDolu = true;
        if (callbacks.onCheck) await callbacks.onCheck("❌ Sefer şu anda dolu. Boş yer açılınca haber verilecektir.");
      }

      await new Promise((r) => setTimeout(r, 3000));
    }
  } catch (err) {
    if (callbacks.onError) await callbacks.onError(err);
  } finally {
    stopCheckingFlags.delete(chatId);
    await closeBrowser();
  }
}

function stopCheckingLoop(chatId) {
  stopCheckingFlags.set(chatId, true);
  stopProgressFlags.set(chatId, true);
}

function setStopFlag(chatId) {
  stopProgressFlags.set(chatId, true);
}

module.exports = {
  getExpeditionList,
  closeListBrowser,
  startCheckingLoop,
  stopCheckingLoop,
  setStopFlag
};
