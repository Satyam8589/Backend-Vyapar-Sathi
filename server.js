import "./config/env.js"; // MUST be first — loads dotenv before any other module reads process.env
import app from "./app.js";
import http from "http";


const PORT = process.env.PORT || 5000;
const HOST = "0.0.0.0";

const server = http.createServer(app);

const start = async () => {
    try {
        server.listen(PORT, HOST, () => {
            console.log(`Server is running on port http://${HOST}:${PORT}`);
        });
    } catch (error) {
        console.error("Server failed to start:", error);
    }
};

// Graceful shutdown on cloud deployment stop/restart signals (Render, Railway, Docker)
process.on("SIGTERM", () => {
    console.log("SIGTERM received. Shutting down gracefully...");
    server.close(() => {
        console.log("Server closed successfully.");
        process.exit(0);
    });
});

process.on("SIGINT", () => {
    console.log("SIGINT received. Shutting down gracefully...");
    server.close(() => {
        console.log("Server closed successfully.");
        process.exit(0);
    });
});

start();
