import { ApiResponse } from "../../utils/ApiResponse.js";
import {
  askStoreCopilot,
  streamStoreCopilot,
  getProductInsightDetail,
  getStoreForecast,
  getStoreInsights,
  getStoreRestockPlan,
  getStoreSummary,
} from "./ai.service.js";

export const getForecastController = async (req, res) => {
  try {
    console.log(`[AI CONTROLLER] GET /forecast for store=${req.params.storeId}`);
    const data = await getStoreForecast(req.params.storeId, req.user._id);
    console.log(`[AI CONTROLLER] GET /forecast completed with ${data.length} items`);
    res
      .status(200)
      .json(new ApiResponse(data, "Forecast generated successfully", 200));
  } catch (error) {
    res
      .status(error.statusCode || 500)
      .json(new ApiResponse(null, error.message, error.statusCode || 500));
  }
};

export const getRestockController = async (req, res) => {
  try {
    console.log(`[AI CONTROLLER] GET /restock for store=${req.params.storeId}`);
    const data = await getStoreRestockPlan(req.params.storeId, req.user._id);
    console.log(`[AI CONTROLLER] GET /restock completed with ${data.length} items`);
    res
      .status(200)
      .json(new ApiResponse(data, "Restock plan generated successfully", 200));
  } catch (error) {
    res
      .status(error.statusCode || 500)
      .json(new ApiResponse(null, error.message, error.statusCode || 500));
  }
};

export const getInsightsController = async (req, res) => {
  try {
    console.log(`[AI CONTROLLER] GET /insights for store=${req.params.storeId}`);
    const data = await getStoreInsights(req.params.storeId, req.user._id);
    console.log(`[AI CONTROLLER] GET /insights completed with ${data.length} items`);
    res
      .status(200)
      .json(new ApiResponse(data, "Insights generated successfully", 200));
  } catch (error) {
    res
      .status(error.statusCode || 500)
      .json(new ApiResponse(null, error.message, error.statusCode || 500));
  }
};

export const getSummaryController = async (req, res) => {
  try {
    console.log(`[AI CONTROLLER] GET /summary for store=${req.params.storeId}`);
    const data = await getStoreSummary(req.params.storeId, req.user._id);
    console.log(`[AI CONTROLLER] GET /summary completed`);
    res
      .status(200)
      .json(new ApiResponse(data, "Store summary generated successfully", 200));
  } catch (error) {
    res
      .status(error.statusCode || 500)
      .json(new ApiResponse(null, error.message, error.statusCode || 500));
  }
};

export const getProductInsightController = async (req, res) => {
  try {
    const data = await getProductInsightDetail(
      req.params.storeId,
      req.params.productId,
      req.user._id
    );
    res
      .status(200)
      .json(new ApiResponse(data, "Product insight generated successfully", 200));
  } catch (error) {
    res
      .status(error.statusCode || 500)
      .json(new ApiResponse(null, error.message, error.statusCode || 500));
  }
};

export const getCopilotController = async (req, res) => {
  try {
    const message = String(req.body?.message || "").trim();

    if (!message) {
      return res
        .status(400)
        .json(new ApiResponse(null, "message is required", 400));
    }

    const data = await askStoreCopilot(req.params.storeId, req.user._id, message);
    res
      .status(200)
      .json(new ApiResponse(data, "Copilot response generated successfully", 200));
  } catch (error) {
    res
      .status(error.statusCode || 500)
      .json(new ApiResponse(null, error.message, error.statusCode || 500));
  }
};

export const getCopilotStreamController = async (req, res) => {
  try {
    const message = String(req.body?.message || "").trim();

    if (!message) {
      return res
        .status(400)
        .json(new ApiResponse(null, "message is required", 400));
    }

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    if (typeof res.flushHeaders === "function") {
      res.flushHeaders();
    }

    for await (const chunk of streamStoreCopilot(req.params.storeId, req.user._id, message)) {
      res.write(chunk);
    }

    res.end();
  } catch (error) {
    const message = error?.message || "Streaming failed";
    try {
      res.write(`event: error\ndata: ${JSON.stringify({ message })}\n\n`);
      res.end();
    } catch {
      res.end();
    }
  }
};
