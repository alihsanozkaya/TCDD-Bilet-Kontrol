import axios from "axios";
import dotenv from "dotenv";
dotenv.config();

const API_URL = process.env.API_URL;
const basePath = "/searches";

const REQUEST_TIMEOUT_MS = 30000;

if (!API_URL) {
  console.error("[searchService] API_URL tanımlı değil (.env kontrol edin)");
}

const http = axios.create({
  baseURL: `${API_URL}${basePath}`,
  timeout: REQUEST_TIMEOUT_MS,
});

/**
 * Axios hatasını sade bir Error'a çevirir.
 * - status        : API'nin döndürdüğü HTTP kodu (yanıt geldiyse)
 * - code          : ECONNABORTED / ETIMEDOUT gibi ağ hata kodu
 * - isNetworkError: yanıt hiç gelmediyse true (timeout, bağlantı hatası)
 * Böylece checker geçici hata ile kalıcı hatayı ayırt edebiliyor ve
 * loglara devasa axios nesnesi basılmıyor.
 */
const normalizeError = (err) => {
  if (!err?.isAxiosError) return err;

  const status = err.response?.status;
  const message =
    err.response?.data?.message || err.message || "İstek başarısız oldu";

  const normalized = new Error(message);
  normalized.status = status;
  normalized.code = err.code;
  normalized.isNetworkError = !err.response;

  return normalized;
};

const logError = (label, err) => {
  const normalized = normalizeError(err);
  const status = normalized.status ? `HTTP ${normalized.status} - ` : "";
  console.error(`[${label}] ${status}${normalized.message}`);
};

export const getAllActiveSearches = async () => {
  try {
    const res = await http.get("");
    return Array.isArray(res.data) ? res.data : [];
  } catch (err) {
    logError("getAllActiveSearches", err);
    return [];
  }
};

export const getActiveSearchesByUser = async (userId) => {
  try {
    const res = await http.get(`/user/${userId}`);
    return Array.isArray(res.data) ? res.data : [];
  } catch (err) {
    logError("getActiveSearchesByUser", err);
    return [];
  }
};

export const createSearch = async ({
  userId,
  fromStationCode,
  toStationCode,
  seatType,
  travelDate,
  tripList,
}) => {
  try {
    const res = await http.post("", {
      userId,
      fromStationCode,
      toStationCode,
      seatType,
      travelDate,
      tripList,
    });
    return res.data;
  } catch (err) {
    // telegramBot 409'u err.status üzerinden yakalıyor.
    throw normalizeError(err);
  }
};

export const preview = async ({
  fromStationId,
  toStationId,
  departureDate,
}) => {
  try {
    const res = await http.post("/preview", {
      fromStationId,
      toStationId,
      departureDate,
    });
    return res.data;
  } catch (err) {
    throw normalizeError(err);
  }
};

export const foundSearch = async (id) => {
  try {
    const res = await http.post("/foundSearch", { id });
    return res.data;
  } catch (err) {
    logError("foundSearch", err);
    return null;
  }
};

export const stopSearch = async (id) => {
  try {
    const res = await http.post("/stopSearch", { id });
    return res.data;
  } catch (err) {
    logError("stopSearch", err);
    return null;
  }
};

export const stopErrorSearch = async (id) => {
  try {
    const res = await http.post("/stopErrorSearch", { id });
    return res.data;
  } catch (err) {
    logError("stopErrorSearch", err);
    return null;
  }
};

export const stopDatePassedSearch = async (id) => {
  try {
    const res = await http.post("/stopDatePassed", { id });
    return res.data;
  } catch (err) {
    logError("stopDatePassedSearch", err);
    return null;
  }
};
