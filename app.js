import express from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import dotenv from "dotenv";
import mongoose from "mongoose";
import router from "./router/index.js";
import connectDB from "./config/db.js";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const app = express();

connectDB();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS - only allow frontend origins
const allowedOrigins = [
  "https://vyapar-sathi.vercel.app",
  "http://localhost:3000",
];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g. mobile apps, curl, Postman)
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) {
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
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`\n[${timestamp}] ${req.method} ${req.originalUrl}`);
  console.log(`[REQUEST] IP: ${req.ip || req.connection.remoteAddress}`);
  if (req.body && Object.keys(req.body).length > 0) {
    console.log(`[REQUEST] Body:`, JSON.stringify(req.body, null, 2));
  }
  next();
});

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

    if (!dbState) {
      return res.status(500).json({
        status: "unhealthy",
        db: "disconnected",
      });
    }

    res.status(200).json({
      status: "healthy",
      uptime,
      timestamp: Date.now(),
    });

  } catch (err) {
    res.status(500).json({ status: "error", error: err.message });
  }
});

app.use("/api", router);

export default app;
