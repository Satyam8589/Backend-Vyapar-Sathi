import "./config/env.js"; // MUST be first — loads dotenv before any other module reads process.env
import app from "./app.js";
import http from "http";
import { createProxyMiddleware } from "http-proxy-middleware";


const PORT = process.env.PORT || 5000;
const HOST = "0.0.0.0";

const server = http.createServer(app);

// Initialize WebSockets for real-time notifications (Firebase Auth enabled)
import { initWebSocket } from "./utils/websocket.js";
initWebSocket(server);

// Proxy configuration for FastAPI AI Service (WebSockets)
const aiServiceUrl = process.env.AI_SERVICE_URL || "http://127.0.0.1:8000";

console.log("[AI Proxy] Configured target AI_SERVICE_URL:", aiServiceUrl);

const aiProxy = createProxyMiddleware({
    target: aiServiceUrl,
    changeOrigin: true,
    ws: true,
    secure: false,
    on: {
        error: (err, req, res) => {
            console.error("[AI Proxy Error]", err.message);
        },
    },
});

// Route /api/ai/* HTTP requests through the proxy (if any REST calls needed)
app.use("/ws", aiProxy);

// Handle WebSocket upgrade events — forward /ws/voice to FastAPI
server.on("upgrade", (req, socket, head) => {
    if (req.url && req.url.startsWith("/ws/voice")) {
        aiProxy.upgrade(req, socket, head);
    }
});

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
