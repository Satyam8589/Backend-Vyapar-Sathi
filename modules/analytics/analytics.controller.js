import { Types } from "mongoose";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { ApiError } from "../../utils/ApiError.js";
import {
  getStoreSummary,
  getStoreTrend,
  getStoreCategoryPerformance,
} from "./storeAnalytics.service.js";
import {
  getTopProducts,
  getSlowMovingProducts,
  getProductOverview,
} from "./productAnalytics.service.js";

const MAX_RANGE_DAYS = 180;

const parseDateRange = (query) => {
  const endDate = query.endDate ? new Date(query.endDate) : new Date();

  if (Number.isNaN(endDate.getTime())) {
    throw new ApiError("Invalid endDate. Use ISO format (YYYY-MM-DD).", 400);
  }

  const startDate = query.startDate
    ? new Date(query.startDate)
    : new Date(endDate.getTime() - 29 * 24 * 60 * 60 * 1000);

  if (Number.isNaN(startDate.getTime())) {
    throw new ApiError("Invalid startDate. Use ISO format (YYYY-MM-DD).", 400);
  }

  const normalizedStart = new Date(startDate);
  normalizedStart.setHours(0, 0, 0, 0);

  const normalizedEnd = new Date(endDate);
  normalizedEnd.setHours(23, 59, 59, 999);

  if (normalizedStart > normalizedEnd) {
    throw new ApiError("startDate cannot be after endDate.", 400);
  }

  const diffDays = Math.ceil(
    (normalizedEnd.getTime() - normalizedStart.getTime()) / (24 * 60 * 60 * 1000)
  ) + 1;

  if (diffDays > MAX_RANGE_DAYS) {
    throw new ApiError(`Date range too large. Max allowed is ${MAX_RANGE_DAYS} days.`, 400);
  }

  return {
    startDate: normalizedStart,
    endDate: normalizedEnd,
    days: diffDays,
  };
};

const parseLimit = (value, fallback = 10, max = 50) => {
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0 || parsed > max) {
    throw new ApiError(`Invalid limit. Use an integer between 1 and ${max}.`, 400);
  }

  return parsed;
};

const validateObjectId = (id, label) => {
  if (!Types.ObjectId.isValid(id)) {
    throw new ApiError(`Invalid ${label}.`, 400);
  }
};

const handleControllerError = (res, error) => {
  res
    .status(error.statusCode || 500)
    .json(new ApiResponse(null, error.message || "Internal Server Error", error.statusCode || 500));
};

export const getStoreSummaryController = async (req, res) => {
  try {
    validateObjectId(req.params.storeId, "storeId");
    const range = parseDateRange(req.query);

    const summary = await getStoreSummary(req.params.storeId, range);

    res
      .status(200)
      .json(new ApiResponse(summary, "Store analytics summary fetched successfully", 200));
  } catch (error) {
    handleControllerError(res, error);
  }
};

export const getStoreTrendController = async (req, res) => {
  try {
    validateObjectId(req.params.storeId, "storeId");
    const range = parseDateRange(req.query);

    const trend = await getStoreTrend(req.params.storeId, range);

    res
      .status(200)
      .json(new ApiResponse(trend, "Store trend analytics fetched successfully", 200));
  } catch (error) {
    handleControllerError(res, error);
  }
};

export const getStoreCategoryPerformanceController = async (req, res) => {
  try {
    validateObjectId(req.params.storeId, "storeId");
    const range = parseDateRange(req.query);
    const limit = parseLimit(req.query.limit, 8, 30);

    const categories = await getStoreCategoryPerformance(req.params.storeId, range, {
      limit,
    });

    res
      .status(200)
      .json(new ApiResponse(categories, "Store category analytics fetched successfully", 200));
  } catch (error) {
    handleControllerError(res, error);
  }
};

export const getTopProductsController = async (req, res) => {
  try {
    validateObjectId(req.params.storeId, "storeId");
    const range = parseDateRange(req.query);
    const limit = parseLimit(req.query.limit, 10, 50);

    const topProducts = await getTopProducts(req.params.storeId, range, {
      limit,
      sortBy: req.query.sortBy,
      category: req.query.category,
    });

    res
      .status(200)
      .json(new ApiResponse(topProducts, "Top products analytics fetched successfully", 200));
  } catch (error) {
    handleControllerError(res, error);
  }
};

export const getSlowMovingProductsController = async (req, res) => {
  try {
    validateObjectId(req.params.storeId, "storeId");
    const inactivityDays = parseLimit(req.query.inactivityDays, 30, 365);
    const limit = parseLimit(req.query.limit, 20, 100);

    const slowMoving = await getSlowMovingProducts(req.params.storeId, {
      inactivityDays,
      limit,
    });

    res
      .status(200)
      .json(new ApiResponse(slowMoving, "Slow-moving products analytics fetched successfully", 200));
  } catch (error) {
    handleControllerError(res, error);
  }
};

export const getProductOverviewController = async (req, res) => {
  try {
    validateObjectId(req.params.storeId, "storeId");
    validateObjectId(req.params.productId, "productId");
    const range = parseDateRange(req.query);

    const overview = await getProductOverview(
      req.params.storeId,
      req.params.productId,
      range
    );

    res
      .status(200)
      .json(new ApiResponse(overview, "Product analytics fetched successfully", 200));
  } catch (error) {
    handleControllerError(res, error);
  }
};
