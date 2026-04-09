import { ApiResponse } from "../../utils/ApiResponse.js";
import {
  getProductInsightDetail,
  getStoreForecast,
  getStoreInsights,
  getStoreRestockPlan,
} from "./ai.service.js";

export const getForecastController = async (req, res) => {
  try {
    const data = await getStoreForecast(req.params.storeId, req.user._id);
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
    const data = await getStoreRestockPlan(req.params.storeId, req.user._id);
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
    const data = await getStoreInsights(req.params.storeId, req.user._id);
    res
      .status(200)
      .json(new ApiResponse(data, "Insights generated successfully", 200));
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
