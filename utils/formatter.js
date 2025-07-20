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

module.exports = { isValidDateFormat, formatConfirmationMessage };
