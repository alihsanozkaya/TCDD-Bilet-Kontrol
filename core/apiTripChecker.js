import { preview, stopDatePassedSearch } from "../services/searchService.js";

const runningCheckers = new Map();

async function checkOnce({
  searchId,
  fromStationId,
  toStationId,
  travelDate,
  seatClass,
  selectedTrips,
  callbacks = {},
}) {
  const expiredTrips = selectedTrips.filter((trip) =>
    isExpired(trip, travelDate),
  );

  if (expiredTrips.length === selectedTrips.length) {
    await stopDatePassedSearch(searchId);
    callbacks.onExpired?.(expiredTrips);
    return { found: null, allExpired: true, expiredTrips };
  }

  const trips = await preview({
    fromStationId,
    toStationId,
    departureDate: travelDate,
  });

  for (const activeTrip of selectedTrips) {
    const trip = trips.find(
      (t) => Number(t.trainId) === Number(activeTrip.trainId),
    );

    if (!trip) continue;

    const stock = seatClass === "EKONOMİ" ? trip.economy : trip.business;

    if (stock > 0) {
      return { found: trip };
    }
  }

  return { found: null, allExpired: false };
}

export async function startApiTripChecker({
  searchId,
  fromStationId,
  toStationId,
  travelDate,
  seatClass,
  selectedTrips,
  intervalMs = 10000,
  callbacks = {},
}) {
  if (runningCheckers.has(searchId)) return;

  const timer = setInterval(async () => {
    try {
      const result = await checkOnce({
        searchId,
        fromStationId,
        toStationId,
        travelDate,
        seatClass,
        selectedTrips,
        callbacks,
      });

      if (result.found) {
        clearInterval(timer);
        runningCheckers.delete(searchId);
        callbacks.onFound?.(result.found);
      }

      if (result.allExpired) {
        clearInterval(timer);
        runningCheckers.delete(searchId);
      }
    } catch (err) {
      console.error("[API CHECK ERROR]", searchId, err);

      const errorCount = (runningCheckers.get(searchId)?.errorCount || 0) + 1;

      if (errorCount >= 3) {
        clearInterval(timer);
        runningCheckers.delete(searchId);
        callbacks.onError?.(err);
      } else {
        runningCheckers.set(searchId, {
          ...runningCheckers.get(searchId),
          errorCount,
        });
      }
    }
  }, intervalMs);

  runningCheckers.set(searchId, {
    timer,
    errorCount: 0,
    startedAt: new Date(),
  });
}

export function stopApiChecker(searchId) {
  const checkerData = runningCheckers.get(searchId);
  if (!checkerData) return false;

  clearInterval(checkerData.timer);
  runningCheckers.delete(searchId);
  return true;
}

function isExpired(trip, travelDate) {
  const [day, month, year] = travelDate.split(" ").map(Number);
  const [hour, minute] = trip.departureTime.split(":").map(Number);

  const tripDate = new Date(year, month - 1, day, hour, minute);
  const diffMs = tripDate.getTime() - Date.now();

  return diffMs <= 15 * 60 * 1000;
}
