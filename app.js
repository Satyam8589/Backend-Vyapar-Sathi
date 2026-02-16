import express from "express";
import cors from "cors";
import dotenv from "dotenv";
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

app.use(
  cors({
    origin: "*",
    credentials: true,
  }),
);

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

app.use("/api", router);

export default app;
