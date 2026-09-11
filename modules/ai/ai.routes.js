import { Router } from "express";
import { createProxyMiddleware } from "http-proxy-middleware";

import authMiddleware from "../../middlewares/auth.middleware.js";
import requireUser from "../../middlewares/requireUser.middleware.js";

import http from "http";
import https from "https";

const router = Router();


// ============================================================================
// Authentication
// ============================================================================

router.use(authMiddleware);
router.use(requireUser);


// ============================================================================
// FastAPI Service URL
//
// Local:
//   http://127.0.0.1:8080
//
// Render:
//   https://your-fastapi-service.onrender.com
// ============================================================================

const FASTAPI_URL =
  process.env.AI_SERVICE_URL ||
  "http://127.0.0.1:8080";


// Validate URL during startup

const fastApiTargetUrl = new URL(FASTAPI_URL);

console.log("[AI PROXY] FastAPI target:", {
  protocol: fastApiTargetUrl.protocol,
  hostname: fastApiTargetUrl.hostname,
  port:
    fastApiTargetUrl.port ||
    (fastApiTargetUrl.protocol === "https:"
      ? "443"
      : "80"),
});


// ============================================================================
// Regular HTTP Proxy
// ============================================================================

const aiProxy = createProxyMiddleware({

  target: FASTAPI_URL,

  changeOrigin: true,

  pathRewrite: {
    "^/api/ai": "",
  },

  on: {

    proxyReq: (proxyReq, req) => {

      if (req.user) {

        proxyReq.setHeader(
          "x-user-id",
          req.user._id.toString()
        );

      }

    },

    error: (err, req, res) => {

      console.error(
        "[AI PROXY] FastAPI request failed:",
        err.message
      );

    },

  },

});


// ============================================================================
// SSE Streaming Proxy
// ============================================================================

const sseProxy = async (req, res) => {

  // --------------------------------------------------------------------------
  // Parse FastAPI target
  // --------------------------------------------------------------------------

  const targetUrl = new URL(FASTAPI_URL);


  // --------------------------------------------------------------------------
  // Build forwarded path
  //
  // Example:
  //
  // Incoming:
  //   /api/ai/store123/copilot/stream
  //
  // Forwarded:
  //   /store123/copilot/stream
  // --------------------------------------------------------------------------

  const forwardPath =
    req.originalUrl.replace(
      /^\/api\/ai/,
      ""
    );


  // --------------------------------------------------------------------------
  // Select correct protocol
  //
  // Render:
  //
  // https://service.onrender.com
  //       ↓
  // https module
  //       ↓
  // port 443
  //
  // Local:
  //
  // http://127.0.0.1:8080
  //       ↓
  // http module
  //       ↓
  // port 8080
  // --------------------------------------------------------------------------

  const isHttps =
    targetUrl.protocol === "https:";


  const protocol =
    isHttps
      ? https
      : http;


  const port =
    targetUrl.port
      ? Number(targetUrl.port)
      : isHttps
        ? 443
        : 80;


  // --------------------------------------------------------------------------
  // Prepare request body
  // --------------------------------------------------------------------------

  const body = JSON.stringify(
    req.body || {}
  );


  // --------------------------------------------------------------------------
  // Request options
  // --------------------------------------------------------------------------

  const options = {

    hostname: targetUrl.hostname,

    port,

    path: forwardPath,

    method: "POST",

    headers: {

      "Content-Type":
        "application/json",

      "Content-Length":
        Buffer.byteLength(body),

      "Accept":
        "text/event-stream",

      "x-user-id":
        req.user
          ? req.user._id.toString()
          : "",

    },

  };


  console.log(
    "[SSE PROXY] Forwarding request:",
    {
      protocol:
        targetUrl.protocol,

      hostname:
        targetUrl.hostname,

      port,

      path:
        forwardPath,
    }
  );


  // --------------------------------------------------------------------------
  // Create upstream request
  // --------------------------------------------------------------------------

  const proxyReq = protocol.request(
    options,

    (proxyRes) => {


      console.log(
        "[SSE PROXY] FastAPI response:",
        {
          statusCode:
            proxyRes.statusCode,

          contentType:
            proxyRes.headers["content-type"],
        }
      );


      // ----------------------------------------------------------------------
      // FastAPI returned an error
      // ----------------------------------------------------------------------

      if (
        !proxyRes.statusCode ||
        proxyRes.statusCode >= 400
      ) {

        let errorBody = "";

        proxyRes.on(
          "data",
          (chunk) => {

            errorBody +=
              chunk.toString();

          }
        );

        proxyRes.on(
          "end",
          () => {

            console.error(
              "[SSE PROXY] FastAPI error:",
              {
                statusCode:
                  proxyRes.statusCode,

                body:
                  errorBody,
              }
            );


            // Send SSE error event

            res.setHeader(
              "Content-Type",
              "text/event-stream"
            );

            res.write(
              `event: error\n` +
              `data: ${JSON.stringify({
                message:
                  "FastAPI service returned an error",

                status:
                  proxyRes.statusCode,
              })}\n\n`
            );

            res.end();

          }
        );

        return;

      }


      // ----------------------------------------------------------------------
      // Forward SSE headers
      // ----------------------------------------------------------------------

      res.status(
        proxyRes.statusCode || 200
      );


      res.setHeader(
        "Content-Type",
        "text/event-stream"
      );


      res.setHeader(
        "Cache-Control",
        "no-cache, no-transform"
      );


      res.setHeader(
        "Connection",
        "keep-alive"
      );


      res.setHeader(
        "X-Accel-Buffering",
        "no"
      );


      // Flush headers before streaming

      res.flushHeaders();


      // ----------------------------------------------------------------------
      // Forward FastAPI stream directly
      // ----------------------------------------------------------------------

      proxyRes.pipe(res);


      // ----------------------------------------------------------------------
      // Handle upstream errors
      // ----------------------------------------------------------------------

      proxyRes.on(
        "error",

        (err) => {

          console.error(
            "[SSE PROXY] FastAPI stream error:",
            err.message
          );


          if (!res.writableEnded) {

            res.end();

          }

        }

      );


    }
  );


  // ==========================================================================
  // Upstream connection error
  // ==========================================================================

  proxyReq.on(
    "error",

    (err) => {

      console.error(
        "[SSE PROXY] Request to FastAPI failed:",
        err
      );


      if (!res.headersSent) {

        res.setHeader(
          "Content-Type",
          "text/event-stream"
        );

        res.setHeader(
          "Cache-Control",
          "no-cache"
        );

        res.flushHeaders();

      }


      if (!res.writableEnded) {

        res.write(
          `event: error\n` +
          `data: ${JSON.stringify({
            message:
              "Unable to connect to AI service",

            error:
              err.message,
          })}\n\n`
        );

        res.end();

      }

    }

  );


  // ==========================================================================
  // Send request body
  // ==========================================================================

  proxyReq.write(
    body
  );


  proxyReq.end();


  // ==========================================================================
  // Client disconnect handling
  // ==========================================================================

  req.on(
    "close",

    () => {

      if (!proxyReq.destroyed) {

        console.log(
          "[SSE PROXY] Client disconnected"
        );

        proxyReq.destroy();

      }

    }

  );


};


// ============================================================================
// Streaming route
//
// Must come before the catch-all proxy.
// ============================================================================

router.post(
  /\/[^/]+\/copilot\/stream/,
  sseProxy
);


// ============================================================================
// All remaining AI requests
// ============================================================================

router.use(
  "/",
  aiProxy
);


export default router;
