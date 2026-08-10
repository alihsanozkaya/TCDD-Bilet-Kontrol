import { preview, stopDatePassedSearch } from "../services/searchService.js";

const runningCheckers = new Map();

const DEFAULT_INTERVAL_MS = 45000;
const MIN_INTERVAL_MS = 10000;

const MAX_TRANSIENT_ERRORS = 20;
const MAX_FATAL_ERRORS = 3;

const EXPIRY_MARGIN_MS = 15 * 60 * 1000;
const TURKEY_UTC_OFFSET_HOURS = 3;

const TRANSIENT_ERROR_CODES = new Set([
  "ECONNABORTED",
  "ETIMEDOUT",
  "ECONNRESET",
  "ECONNREFUSED",
  "EAI_AGAIN",
  "ENOTFOUND",
  "EPIPE",
  "ERR_NETWORK",
]);

const checkerKey = (searchId) => String(searchId);

export function startApiTripChecker({
  searchId,
  fromStationId,
  toStationId,
  travelDate,
  seatClass,
  selectedTrips,
  intervalMs = DEFAULT_INTERVAL_MS,
  callbacks = {},
}) {
  const id = checkerKey(searchId);
  if (runningCheckers.has(id)) return false;

  const state = {
    timer: null,
    isChecking: false,
    transientErrors: 0,
    fatalErrors: 0,
    startedAt: new Date(),
  };

  runningCheckers.set(id, state);

  const stop = () => {
    if (state.timer) clearInterval(state.timer);
    state.timer = null;
    if (runningCheckers.get(id) === state) runningCheckers.delete(id);
  };

  const tick = async () => {
    if (state.isChecking) return;
    if (runningCheckers.get(id) !== state) return;

    state.isChecking = true;
    try {
      const result = await checkOnce({
        searchId: id,
        fromStationId,
        toStationId,
        travelDate,
        seatClass,
        selectedTrips,
      });

      state.transientErrors = 0;
      state.fatalErrors = 0;

      if (result.invalidTripList) {
        stop();
        await runCallback(
          callbacks.onError,
          new Error("Aramanın sefer listesi boş veya geçersiz"),
        );
        return;
      }

      if (result.allExpired) {
        stop();
        await runCallback(callbacks.onExpired, result.expiredTrips);
        return;
      }

      if (result.found) {
        stop();
        await runCallback(callbacks.onFound, result.found);
        return;
      }
    } catch (err) {
      const transient = isTransientError(err);

      if (transient) state.transientErrors += 1;
      else state.fatalErrors += 1;

      const count = transient ? state.transientErrors : state.fatalErrors;
      const limit = transient ? MAX_TRANSIENT_ERRORS : MAX_FATAL_ERRORS;

      console.error(
        `[API CHECK ERROR] ${id} ${transient ? "geçici" : "kalıcı"} hata ` +
          `${count}/${limit}: ${describeError(err)}`,
      );

      if (count >= limit) {
        stop();
        await runCallback(callbacks.onError, err);
      }
    } finally {
      state.isChecking = false;
    }
  };

  const safeIntervalMs = Math.max(
    MIN_INTERVAL_MS,
    Number(intervalMs) || DEFAULT_INTERVAL_MS,
  );

  state.timer = setInterval(() => {
    tick().catch((err) =>
      console.error("[API CHECK FATAL]", id, describeError(err)),
    );
  }, safeIntervalMs);

  return true;
}

export function stopApiChecker(searchId) {
  const id = checkerKey(searchId);
  const state = runningCheckers.get(id);
  if (!state) return false;

  if (state.timer) clearInterval(state.timer);
  state.timer = null;
  runningCheckers.delete(id);
  return true;
}

export function isCheckerRunning(searchId) {
  return runningCheckers.has(checkerKey(searchId));
}

async function checkOnce({
  searchId,
  fromStationId,
  toStationId,
  travelDate,
  seatClass,
  selectedTrips,
}) {
  const watchedTrips = Array.isArray(selectedTrips) ? selectedTrips : [];

  if (watchedTrips.length === 0) {
    return { found: null, invalidTripList: true };
  }

  const expiredTrips = [];
  const activeTrips = [];

  for (const trip of watchedTrips) {
    if (isExpired(trip, travelDate)) expiredTrips.push(trip);
    else activeTrips.push(trip);
  }

  if (activeTrips.length === 0) {
    await stopDatePassedSearch(searchId);
    return { found: null, allExpired: true, expiredTrips };
  }

  const trips = await preview({
    fromStationId,
    toStationId,
    departureDate: travelDate,
  });

  if (!Array.isArray(trips)) {
    throw new Error("preview beklenmeyen bir yanıt döndürdü (dizi değil)");
  }

  const wantsEconomy = isEconomyClass(seatClass);

  for (const activeTrip of activeTrips) {
    const trip = trips.find(
      (t) => Number(t?.trainId) === Number(activeTrip?.trainId),
    );

    if (!trip) continue;

    const stock = Number(wantsEconomy ? trip.economy : trip.business) || 0;

    if (stock > 0) {
      return { found: trip };
    }
  }

  return { found: null, allExpired: false };
}

export function isEconomyClass(seatClass) {
  const normalized = String(seatClass ?? "")
    .trim()
    .toLocaleUpperCase("tr-TR");

  return normalized === "EKONOMİ" || normalized === "EKONOMI";
}

function isExpired(trip, travelDate) {
  const departureUtcMs = departureUtcMsOf(trip, travelDate);

  if (departureUtcMs === null) return false;

  return departureUtcMs - Date.now() <= EXPIRY_MARGIN_MS;
}

function departureUtcMsOf(trip, travelDate) {
  const [day, month, year] = String(travelDate ?? "")
    .trim()
    .split(" ")
    .map(Number);

  const [hour, minute] = String(trip?.departureTime ?? "")
    .trim()
    .split(":")
    .map(Number);

  const parts = [day, month, year, hour, minute];
  if (parts.some((value) => !Number.isFinite(value))) return null;

  return Date.UTC(
    year,
    month - 1,
    day,
    hour - TURKEY_UTC_OFFSET_HOURS,
    minute,
    0,
    0,
  );
}

function isTransientError(err) {
  const status = err?.status ?? err?.response?.status;

  if (Number.isFinite(status)) {
    return status >= 500 || status === 408 || status === 429;
  }

  if (err?.isNetworkError) return true;

  return TRANSIENT_ERROR_CODES.has(err?.code);
}

function describeError(err) {
  if (!err) return "bilinmeyen hata";

  const status = err.status ?? err.response?.status;
  const detail =
    err.response?.data?.message || err.message || String(err) || "detay yok";

  return status ? `HTTP ${status} - ${detail}` : detail;
}

async function runCallback(callback, payload) {
  if (typeof callback !== "function") return;

  try {
    await callback(payload);
  } catch (err) {
    console.error("[API CHECK CALLBACK ERROR]", describeError(err));
  }
}
