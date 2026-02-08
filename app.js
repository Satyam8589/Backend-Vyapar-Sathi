import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import router from "./router/index.js";
import connectDB from "./config/db.js";
dotenv.config();

const app = express();

connectDB();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(cors({
    origin: "*",
    credentials: true
}));

app.use("/api", router);

export default app;