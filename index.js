require('dotenv').config();
const { chromium } = require("playwright");
const { Client } = require("whatsapp-web.js");
const qrcode = require("qrcode-terminal");

const DEPARTURE_STATION = "566";
const ARRIVAL_STATION = "93";
const DEPARTURE_DATE = "25 07 2025";

const TARGET_WHATSAPP_NUMBER = process.env.TARGET_WHATSAPP_NUMBER;

let whatsappReady = false;
let stopChecking = false;

const whatsappClient = new Client();

whatsappClient.on("qr", (qr) => {
  console.clear();
  console.log("WhatsApp ile QR kodunu okut:");
  qrcode.generate(qr, { small: true });
});

whatsappClient.on("ready", () => {
  console.log("📱 WhatsApp bağlantısı hazır.");
  whatsappReady = true;
  startCheckingLoop();
});

whatsappClient.initialize();

async function selectStation(page, dropdownId, stationId) {
  await page.click(`#${dropdownId}`);
  await page.waitForTimeout(100);
  await page.click(`#${stationId}`);
  await page.waitForTimeout(100);
}

async function selectDate(page, dateClass) {
  await page.click(`.${dateClass}`);
  await page.waitForTimeout(100);
  await page.click(`[id="${DEPARTURE_DATE}"]`);
  await page.waitForTimeout(100);
}

async function clickButton(page, buttonId) {
  await page.click(`#${buttonId}`);
  await page.waitForTimeout(100);
}

async function checkEconomyClass(page) {
  const buttons = await page.$$(
    `#collapseBodygidis1 button[id^="sefer-"][id$="-departure"]`
  );

  for (const button of buttons) {
    const text = await button.innerText();

    if (text.includes("EKONOMİ")) {
      const className = await button.getAttribute("class");
      const isDisabled = className.includes("disabled");
      const isFull = text.includes("DOLU");

      if (!isDisabled && !isFull) {
        if (whatsappReady) {
          await whatsappClient.sendMessage(
            TARGET_WHATSAPP_NUMBER,
            "🚨 EKONOMİ sınıfında boş yer açıldı! Hemen siteyi kontrol et: https://ebilet.tcddtasimacilik.gov.tr/"
          );
          stopChecking = true;
        } else {
          console.log("⚠️ WhatsApp hazır değil, mesaj gönderilemedi.");
        }
      }
      // else {
      //   if (whatsappReady) {
      //     await whatsappClient.sendMessage(
      //       TARGET_WHATSAPP_NUMBER,
      //       "EKONOMİ sınıfı dolu. Kontrol etmeye devam ediyorum..."
      //     );
      //   }
      // }
      return;
    }
  }
}

async function checkTrainTickets() {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  await page.goto("https://ebilet.tcddtasimacilik.gov.tr/", {
    waitUntil: "load",
  });

  await selectStation(page, "fromTrainInput", `gidis-${DEPARTURE_STATION}`);
  await selectStation(page, "toTrainInput", `donus-${ARRIVAL_STATION}`);
  await selectDate(page, "departureDate");
  await clickButton(page, "searchSeferButton");
  await clickButton(page, "gidis1btn");

  await checkEconomyClass(page);

  await page.waitForTimeout(1500);
  await browser.close();
}

async function startCheckingLoop() {
  while (!stopChecking) {
    try {
      await checkTrainTickets();
    } catch (error) {
      console.error("Hata:", error);
    }
    if (!stopChecking) {
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }
  }
  process.exit(0);
}
