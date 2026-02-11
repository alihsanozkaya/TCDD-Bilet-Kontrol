import { preview, refreshSearchTripList } from "../services/searchService.js";

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
  await refreshSearchTripList(searchId);

  const { active, expired } = splitExpiredTrips(selectedTrips, travelDate);

  if (active.length === 0) {
    callbacks.onExpiredNotified?.(expired);
    return { found: null, allExpired: true, expiredTrips: expired };
  }

  const trips = await preview({
    fromStationId,
    toStationId,
    departureDate: travelDate,
  });

  for (const activeTrip of active) {
    const trip = trips.find(
      (t) => Number(t.trainId) === Number(activeTrip.trainId),
    );

    if (!trip) {
      continue;
    }

    const stock = seatClass === "EKONOMİ" ? trip.economy : trip.business;

    if (stock > 0) {
      return { found: trip };
    }
  }

  return { found: null, allExpired: false, expiredTrips: expired };
}

export async function startApiTripChecker({
  searchId,
  fromStationId,
  toStationId,
  travelDate,
  seatClass,
  selectedTrips,
  intervalMs = 30000,
  callbacks = {},
}) {
  if (runningCheckers.has(searchId)) return;

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
      callbacks.onFound?.(result.found);
      return;
    }

    if (result.allExpired) {
      callbacks.onExpired?.(result.expiredTrips);
      return;
    }
  } catch (err) {
    console.error("[API INITIAL CHECK ERROR]", searchId, err);
  }

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
        return;
      }

      if (result.allExpired) {
        clearInterval(timer);
        runningCheckers.delete(searchId);

        callbacks.onExpired?.(result.expiredTrips);
        return;
      }
    } catch (err) {
      console.error("[API CHECK ERROR]", searchId, err);

      const errorCount = (runningCheckers.get(searchId)?.errorCount || 0) + 1;

      if (errorCount >= 3) {
        console.error("[API CHECK STOPPED - TOO MANY ERRORS]", searchId);
        clearInterval(timer);
        runningCheckers.delete(searchId);
        callbacks.onError?.(err);
      } else {
        const checkerData = runningCheckers.get(searchId);
        if (checkerData) {
          runningCheckers.set(searchId, {
            ...checkerData,
            errorCount,
          });
        }
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

function splitExpiredTrips(trips, travelDate) {
  const now = new Date();

  const active = [];
  const expired = [];

  for (const trip of trips) {
    const depTime = buildTripDate(travelDate, trip.departureTime);

    if (isNaN(depTime)) {
      console.warn("[TRIP DATE INVALID]", trip);
      expired.push(trip);
      continue;
    }

    if (depTime <= now) expired.push(trip);
    else active.push(trip);
  }

  return { active, expired };
}

function buildTripDate(travelDate, timeHHMM) {
  const [day, month, year] = travelDate.split(" ").map(Number);
  const [hour, minute] = timeHHMM.split(":").map(Number);
  return new Date(year, month - 1, day, hour, minute);
}
