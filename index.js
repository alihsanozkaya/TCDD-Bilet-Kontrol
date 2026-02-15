import express from "express";
import "dotenv/config";
import { startTelegramBot } from "./platforms/telegramBot.js";

const app = express();
app.use(express.json());

app.get("/", (req, res) => res.json({ status: "ok" }));

startTelegramBot();

const port = process.env.PORT || 3003;
app.listen(port, '0.0.0.0', () => console.log(`Bot başlatıldı ${port}`));
