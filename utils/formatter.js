import * as MSG from "../utils/messages.js";

export function parseTripText(text) {
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

export function formatTripistItem(exp, index, stationMap) {
  const fromName =
    stationMap?.get(String(exp.departureStationId)) ?? exp.departureStationId;

  const toName =
    stationMap?.get(String(exp.arrivalStationId)) ?? exp.arrivalStationId;

  return (
    `${index + 1}. 🚅 YHT ${exp.commercialName}\n\n` +
    `  🚉 ${fromName} → ${toName}\n` +
    `  🕒 ${exp.departure} - ${exp.arrival} (${exp.duration})\n` +
    `  💺 Ekonomi: ${exp.economy} | Business: ${exp.business}\n`
  );
}

export function formatActiveSearches(searches, stations, seats) {
  if (!searches.length) return MSG.noActiveSearch;

  const stationMap = new Map(stations.map(s => [s.code, s.name]));
  const seatMap = new Map(seats.map(s => [s._id, s.name]));

  let message = MSG.activeSearch;

  searches.forEach((search, i) => {
    const fromName = stationMap.get(search.fromStationCode);
    const toName = stationMap.get(search.toStationCode);
    const seatName = seatMap.get(search.seatType);

    const times = search.tripList
      .map(t => t.departureTime)
      .join(", ");

    message += `${i + 1})\n`;
    message += `   🚉 ${fromName} → ${toName}\n`;
    message += `   📅 ${search.travelDate}\n`;
    message += `   ⏱️ ${times}\n`;
    message += `   💺 ${seatName}\n`;
    message += `   🚂 ${search.tripList.length} sefer izleniyor\n\n`;
  });

  return message;
}

export function formatTripDate(dateStr) {
  return dateStr.replace(/\./g, " ");
}