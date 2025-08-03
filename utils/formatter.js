function isValidDateFormat(dateStr) {
  return /^\d{2} \d{2} \d{4}$/.test(dateStr);
}

function formatConfirmationMessage(fromCode, toCode, date, stations) {
  return `✅ Bilgiler alındı:
Kalkış: ${stations[fromCode]}
Varış: ${stations[toCode]}
Tarih: ${date}

🔍 Sorgu başlatılıyor...`;
}

function parseExpeditionText(text) {
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  return {
    trainLine: lines[0] || "🚄 Tren Bilgisi Bulunamadı",
    departureStation: lines[2] || "Kalkış ?",
    duration: lines[3] || "Süre ?",
    arrivalStation: lines[4] || "Varış ?",
    departureTime: lines[5] || "Kalkış Saati ?",
    arrivalTime: lines[6] || "Varış Saati ?",
    priceLine: lines.find((line) => line.includes("₺")) || "₺ ???",
    date: lines[7] || "Tarih ?",
    availableSeats: (() => {
      const match = text.match(/\((\d+)\)$/);
      return match ? match[1] : "?";
    })(),
  };
}

function formatExpeditionListItem(exp, index) {
  const {
    trainLine,
    departureStation,
    duration,
    arrivalStation,
    departureTime,
    arrivalTime,
  } = parseExpeditionText(exp.text);

  const emoji = trainLine.startsWith("YHT")
    ? "🚅"
    : trainLine.startsWith("ANAHAT")
    ? "🚞"
    : "🚄";

  return `${index + 1}. ${emoji} ${trainLine}

  🚉 ${departureStation} → ${arrivalStation}
  🕕 ${departureTime} - ${arrivalTime} (${duration})
`;
}

function formatSelectedExpedition(exp) {
  const {
    trainLine,
    departureStation,
    duration,
    arrivalStation,
    departureTime,
    arrivalTime,
    date,
  } = parseExpeditionText(exp.text);

  const emoji = trainLine.startsWith("YHT")
    ? "🚅"
    : trainLine.startsWith("ANAHAT")
    ? "🚞"
    : "🚄";

  return `
✅ Seçilen Sefer:

${emoji} ${trainLine}

  🚉 ${departureStation} → ${arrivalStation}
  📅 ${date}
  🕕 ${departureTime} - ${arrivalTime} (${duration})

📡 Kontrol başlatılıyor...
`.trim();
}

module.exports = {
  isValidDateFormat,
  formatConfirmationMessage,
  formatExpeditionListItem,
  formatSelectedExpedition,
};
