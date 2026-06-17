import * as dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

import express from "express";
import cors from "cors";
import { initDb } from "./db";
import { ticketsRouter } from "./routes/tickets";
import { reviewsRouter } from "./routes/reviews";
import { analyticsRouter } from "./routes/analytics";

const app = express();
const PORT = Number(process.env.PORT ?? 3001);

// ─── Middleware ───────────────────────────────────────────────────────────────

app.use(cors({ origin: ["http://localhost:3000", "http://127.0.0.1:3000"] }));
app.use(express.json());

// ─── Routes ───────────────────────────────────────────────────────────────────

app.use("/api/tickets", ticketsRouter);
app.use("/api/tickets", reviewsRouter);
app.use("/api/analytics", analyticsRouter);

// Health check
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ error: "Route not found" });
});

// ─── Start ────────────────────────────────────────────────────────────────────

initDb();

app.listen(PORT, () => {
  console.log(`🚀  Backend running → http://localhost:${PORT}`);
  console.log(`📋  LLM mode: ${process.env.LLM_PROVIDER ?? "mock"}`);
  console.log(`⏱️   SLA threshold: ${process.env.SLA_URGENT_HOURS ?? 4}h`);
});

export default app;
