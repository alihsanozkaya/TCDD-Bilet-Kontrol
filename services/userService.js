import axios from "axios";
import dotenv from "dotenv";
dotenv.config();

const API_URL = process.env.API_URL;
const basePath = "/users";

const http = axios.create({
  baseURL: `${API_URL}${basePath}`,
  timeout: 15000,
});

export const findOrCreateUser = async (telegramId) => {
  try {
    const res = await http.post("", { telegramId });
    return res.data;
  } catch (err) {
    console.error("[findOrCreateUser]", err.message);
    return null;
  }
};

export const getChatIdByUserId = async (userId) => {
  try {
    const res = await http.get(`/getChatIdByUserId/${userId}`);
    return res.data;
  } catch (err) {
    console.error("[getChatIdByUserId]", err.message);
    return null;
  }
};
