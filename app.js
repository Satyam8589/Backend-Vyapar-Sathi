import express from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import mongoose from "mongoose";

import router from "./router/index.js";
import connectDB from "./config/db.js";
import redisClient from "./config/redis.js";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import emailRoutes from "./modules/email/email.routes.js";
import queueRoutes from "./router/queue.routes.js";
import automationRoutes from "./modules/automation/automation.routes.js";
import "./workers/expressWorker.js";
import "./workers/notificationWorker.js";


const app = express();

// Trust reverse proxy headers (Render, Cloudflare, etc.) for accurate rate-limiting
app.set("trust proxy", 1);

connectDB();

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// CORS - allow configured production origins
const defaultOrigins = [
  "https://vyaparsakha.store",
  "https://www.vyaparsakha.store",
  "https://api.vyaparsakha.store",
  "https://vyapar-sathi.vercel.app",
  "http://localhost:3000",
  "http://localhost:5173",
];

const envOrigins = (process.env.ALLOWED_ORIGINS || process.env.FRONTEND_URL || "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

const allowedOrigins = Array.from(new Set([...defaultOrigins, ...envOrigins]));

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g. mobile apps, curl, Postman)
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin) || allowedOrigins.some((o) => origin.startsWith(o))) {
        return callback(null, true);
      }
      return callback(new Error(`CORS: Origin '${origin}' not allowed`), false);
    },
    credentials: true,
  }),
);

// Global rate limiter - 100 requests per 15 minutes per IP
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: 429,
    error: "Too many requests, please try again later.",
  },
});

// Strict limiter for auth routes - 10 requests per 15 minutes per IP
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: 429,
    error: "Too many authentication attempts, please try again later.",
  },
});

app.use(globalLimiter);
app.use("/api/auth", authLimiter);

// Request logging middleware
// app.use((req, res, next) => {
//   const timestamp = new Date().toISOString();
//   console.log(`\n[${timestamp}] ${req.method} ${req.originalUrl}`);
//   console.log(`[REQUEST] IP: ${req.ip || req.connection.remoteAddress}`);
//   if (req.body && Object.keys(req.body).length > 0) {
//     console.log(`[REQUEST] Body:`, JSON.stringify(req.body, null, 2));
//   }
//   next();
// });

// Serve static files from public directory
app.use(express.static(path.join(__dirname, "public")));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.get("/health", async (req, res) => {
  try {
    // basic process health
    const uptime = process.uptime();

    // DB ping (very important)
    const dbState = mongoose.connection.readyState === 1;
    const redisState = redisClient && redisClient.status === "ready";

    if (!dbState) {
      return res.status(500).json({
        status: "unhealthy",
        db: "disconnected",
        redis: redisState ? "connected" : "disconnected",
      });
    }

    res.status(200).json({
      status: "healthy",
      uptime,
      db: "connected",
      redis: redisState ? "connected" : "disconnected",
      timestamp: Date.now(),
    });

  } catch (err) {
    res.status(500).json({ status: "error", error: err.message });
  }
});

app.use("/api/email", emailRoutes);
app.use("/api/queue", queueRoutes);
app.use("/api/automations", automationRoutes);

app.use("/api", router);

export default app;
