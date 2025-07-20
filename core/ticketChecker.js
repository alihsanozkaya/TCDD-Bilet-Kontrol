const { chromium } = require("playwright");

let browser = null;
let page = null;
const stopCheckingFlags = new Map();
const stopProgressFlags = new Map();

async function launchBrowser() {
  if (!browser) {
    browser = await chromium.launch({
      headless: false,
      args: ["--start-maximized"],
    });
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

async function getExpeditionList(from, to, date, chatId) {
  stopProgressFlags.set(chatId, false);
  await launchBrowser();
  
  await page.goto("https://ebilet.tcddtasimacilik.gov.tr/", {
    waitUntil: "load",
  });

  if (stopProgressFlags.get(chatId)) {
    await closeBrowser();
    return null;
  }
  
  await page.waitForSelector("#fromTrainInput", { timeout: 1000 });
  await page.click("#fromTrainInput");
  await page.waitForTimeout(500);

  if (stopProgressFlags.get(chatId)) {
    await closeBrowser();
    return null;
  }

  await page.waitForSelector(`#gidis-${from}`, { timeout: 1000 });
  await page.click(`#gidis-${from}`);

  if (stopProgressFlags.get(chatId)) {
    await closeBrowser();
    return null;
  }

  await page.waitForSelector("#toTrainInput", { timeout: 1000 });
  await page.click("#toTrainInput");
  await page.waitForTimeout(500);

  if (stopProgressFlags.get(chatId)) {
    await closeBrowser();
    return null;
  }

  await page.waitForSelector(`#donus-${to}`, { timeout: 1000 });
  await page.click(`#donus-${to}`);

  if (stopProgressFlags.get(chatId)) {
    await closeBrowser();
    return null;
  }

  await page.waitForSelector(".departureDate", { timeout: 1000 });
  await page.click(".departureDate");
  await page.waitForTimeout(500);

  if (stopProgressFlags.get(chatId)) {
    await closeBrowser();
    return null;
  }

  await page.waitForSelector(`[id="${date}"]`, { timeout: 1000 });
  await page.click(`[id="${date}"]`);
  await page.waitForTimeout(500);

  if (stopProgressFlags.get(chatId)) {
    await closeBrowser();
    return null;
  }

  await page.waitForSelector("#searchSeferButton", { timeout: 1000 });
  await page.click("#searchSeferButton");
  await page.waitForTimeout(2000);

  if (stopProgressFlags.get(chatId)) {
    await closeBrowser();
    return null;
  }

  await page.waitForSelector(".seferInformationArea", { timeout: 15000 });

  if (stopProgressFlags.get(chatId)) {
    await closeBrowser();
    return null;
  }

  const expeditionButtons = await page.$$(`button[id^="gidis"][id$="btn"]`);

  if (stopProgressFlags.get(chatId)) {
    await closeBrowser();
    return null;
  }

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
  const browserLocal = await chromium.launch({
    headless: false,
    args: ["--start-maximized"],
  });
  const context = await browserLocal.newContext({ viewport: null });
  const pageLocal = await context.newPage();

  try {
    await pageLocal.goto("https://ebilet.tcddtasimacilik.gov.tr/", {
      waitUntil: "load",
    });

    await pageLocal.waitForSelector("#fromTrainInput", { timeout: 1000 });
    await pageLocal.click("#fromTrainInput");
    await pageLocal.waitForTimeout(500);

    await pageLocal.waitForSelector(`#gidis-${from}`, { timeout: 1000 });
    await pageLocal.click(`#gidis-${from}`);

    await pageLocal.waitForSelector("#toTrainInput", { timeout: 1000 });
    await pageLocal.click("#toTrainInput");
    await pageLocal.waitForTimeout(500);

    await pageLocal.waitForSelector(`#donus-${to}`, { timeout: 1000 });
    await pageLocal.click(`#donus-${to}`);

    await pageLocal.waitForSelector(".departureDate", { timeout: 1000 });
    await pageLocal.click(".departureDate");
    await pageLocal.waitForTimeout(500);

    await pageLocal.waitForSelector(`[id="${date}"]`, { timeout: 1000 });
    await pageLocal.click(`[id="${date}"]`);
    await pageLocal.waitForTimeout(500);

    await pageLocal.waitForSelector("#searchSeferButton", { timeout: 1000 });
    await pageLocal.click("#searchSeferButton");
    await pageLocal.waitForTimeout(2000);

    await pageLocal.waitForSelector(".seferInformationArea", { timeout: 15000 });

    await pageLocal.waitForSelector(`#${expeditionId}`, { timeout: 1000 });
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
  stopProgressFlags.set(chatId, true)
}

function stopProgress(chatId) {
  stopProgressFlags.set(chatId, true)
}

module.exports = {
  getExpeditionList,
  closeListBrowser,
  startCheckingLoop,
  stopCheckingLoop,
  stopProgress
};