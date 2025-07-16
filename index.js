const { chromium } = require("playwright");

async function selectStationById(page, dropdownId, stationId) {
  const dropdownSelector = `#${dropdownId}`;
  await page.click(dropdownSelector);
  await page.waitForTimeout(100);

  const stationSelector = `#${stationId}`;
  await page.click(stationSelector);
  await page.waitForTimeout(100);
}

async function searchButton(page, buttonId) {
  const searchSelector = `#${buttonId}`;
  await page.click(searchSelector);
  await page.waitForTimeout(100);
}

async function checkTCDD() {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  await page.goto("https://ebilet.tcddtasimacilik.gov.tr/", {
    waitUntil: "load",
  });

  await selectStationById(page, "fromTrainInput", "gidis-566");
  await selectStationById(page, "toTrainInput", "donus-93");
  await searchButton(page, "searchSeferButton");
}

checkTCDD().catch((e) => console.error("Hata oluştu:", e));
