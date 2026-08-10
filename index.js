import express from "express";
import "dotenv/config";
import { startTelegramBot } from "./platforms/telegramBot.js";

const app = express();
app.use(express.json());

app.get("/", (req, res) => res.json({ status: "ok" }));

process.on("unhandledRejection", (reason) => {
  console.error("[UNHANDLED REJECTION]", reason?.message || reason);
});

process.on("uncaughtException", (err) => {
  console.error("[UNCAUGHT EXCEPTION]", err?.message || err);
});

startTelegramBot();

const port = process.env.PORT || 3003;
app.listen(port, "0.0.0.0", () => console.log(`Bot başlatıldı ${port}`));
