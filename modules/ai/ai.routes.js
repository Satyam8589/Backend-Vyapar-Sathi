import { Router } from "express";
import { createProxyMiddleware } from "http-proxy-middleware";
import authMiddleware from "../../middlewares/auth.middleware.js";
import requireUser from "../../middlewares/requireUser.middleware.js";
import http from "http";
import https from "https";

const router = Router();

// 1. Apply Auth logic first
router.use(authMiddleware);
router.use(requireUser);

// 2. Define the FastAPI URL (ideally from .env)
const FASTAPI_URL = process.env.AI_SERVICE_URL || "http://127.0.0.1:8080";

// 3. Create the Proxy Middleware for regular (non-streaming) endpoints
const aiProxy = createProxyMiddleware({
  target: FASTAPI_URL,
  changeOrigin: true,
  pathRewrite: {
    '^/api/ai': '', // Remove /api/ai prefix when forwarding
  },
  on: {
    proxyReq: (proxyReq, req, res) => {
      if (req.user) {
        proxyReq.setHeader('x-user-id', req.user._id.toString());
      }
    }
  }
});

// 4. Manual SSE proxy for streaming endpoint - http-proxy-middleware buffers SSE
//    so we pipe the request manually to have full control over the stream.
const sseProxy = async (req, res) => {
  const targetUrl = new URL(FASTAPI_URL);
  const forwardPath = req.path.replace(/^\/api\/ai/, "");

  // Set SSE headers immediately so the client starts receiving the stream
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  // Express body-parser already consumed the stream and parsed it into req.body.
  // Re-serialize it back to JSON to send upstream.
  const body = JSON.stringify(req.body || {});

  const options = {
    hostname: targetUrl.hostname,
    port: targetUrl.port || 8080,
    path: forwardPath,
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Content-Length": Buffer.byteLength(body),
      "x-user-id": req.user ? req.user._id.toString() : "",
    },
  };

  const protocol = targetUrl.protocol === "https:" ? https : http;

  const proxyReq = protocol.request(options, (proxyRes) => {
    // Pipe FastAPI's SSE response directly into the Express response
    proxyRes.on("data", (chunk) => {
      res.write(chunk);
    });
    proxyRes.on("end", () => {
      res.end();
    });
    proxyRes.on("error", (err) => {
      console.error("[SSE PROXY] FastAPI stream error:", err.message);
      res.end();
    });
  });

  proxyReq.on("error", (err) => {
    console.error("[SSE PROXY] Request to FastAPI failed:", err.message);
    res.write(`event: error\ndata: ${JSON.stringify({ message: err.message })}\n\n`);
    res.end();
  });

  proxyReq.write(body);
  proxyReq.end();

  // If client disconnects, abort the upstream request
  req.on("close", () => {
    proxyReq.destroy();
  });
};

// 5. Route streaming endpoint to the manual SSE proxy FIRST
router.post(/\/[^/]+\/copilot\/stream/, sseProxy);

// 6. Route ALL other requests to the regular proxy
router.use("/", aiProxy);

export default router;
