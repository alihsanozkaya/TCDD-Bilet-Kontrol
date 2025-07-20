const validStations = {
  "98": "Ankara",
  "93": "Eskişehir",
  "1135": "İzmit YHT",
  "48": "Pendik",
  "1336": "Selçuklu YHT",
  "566": "Sivas",
  "1323": "Söğütlüçeşme"
};

function stationListText() {
  return Object.entries(validStations)
    .sort((a, b) => a[1].localeCompare(b[1]))
    .map(([code, name]) => `${name} => ${code}`)
    .join("\n");
}

module.exports = { validStations, stationListText };
