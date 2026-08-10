import axios from "axios";
import dotenv from "dotenv";
dotenv.config();

const API_URL = process.env.API_URL;
const basePath = "/stations";

const http = axios.create({
  baseURL: `${API_URL}${basePath}`,
  timeout: 15000,
});

export const getAllStations = async () => {
  try {
    const res = await http.get("");
    return Array.isArray(res.data) ? res.data : [];
  } catch (err) {
    console.error("[getAllStations]", err.message);
    return [];
  }
};
