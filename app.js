import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import router from "./router/index.js";
dotenv.config();

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(cors({
    origin: "*",
    credentials: true
}));

app.use("/api", router);

export default app;