import { Product, Sale } from "../../models/index.js";
import { ApiError } from "../../utils/ApiError.js";
import { assertStoreOwner } from "../store/storeAccess.service.js";

const LOOKBACK_DAYS = 30;
const FORECAST_HORIZON_DAYS = 7;
const DEAD_STOCK_DAYS = 30;
const DEFAULT_LEAD_TIME_DAYS = 3;
const AI_SERVICE_URL = process.env.AI_SERVICE_URL || "http://localhost:8000";
const AI_REQUEST_TIMEOUT_MS = 15000;

const toDateKey = (date) => new Date(date).toISOString().slice(0, 10);

export const buildDateWindow = (days = LOOKBACK_DAYS, endDate = new Date()) => {
  const dates = [];

  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const current = new Date(endDate);
    current.setHours(0, 0, 0, 0);
    current.setDate(current.getDate() - offset);
    dates.push(toDateKey(current));
  }

  return dates;
};

const hashValue = (input = "") =>
  String(input)
    .split("")
    .reduce((sum, char) => sum + char.charCodeAt(0), 0);

export const buildSeededHistory = (product, dateKeys) => {
  const hash = hashValue(product._id?.toString() || product.name);
  const baseDaily = Math.max(1, Math.min(8, Math.round((product.quantity || 0) / 6) || 2));
  const slope = ((hash % 7) - 3) * 0.04;
  const weekendBoost = (hash % 3) * 0.25;

  return dateKeys.map((dateKey, index) => {
    const dayOfWeek = new Date(dateKey).getUTCDay();
    const seasonalBoost = dayOfWeek === 0 || dayOfWeek === 6 ? weekendBoost : 0;
    const projected = Math.max(
      0,
      Math.round(
        baseDaily *
          (1 + slope * (index / Math.max(dateKeys.length - 1, 1)) + seasonalBoost)
      )
    );

    return {
      date: dateKey,
      quantity: projected,
      revenue: projected * (product.price || 0),
    };
  });
};

export const aggregateProductSeries = (products, sales, dateKeys) => {
  const historyByProduct = new Map();
  const dateIndex = new Map(dateKeys.map((date, index) => [date, index]));

  for (const product of products) {
    const emptySeries = dateKeys.map((date) => ({
      date,
      quantity: 0,
      revenue: 0,
    }));

    historyByProduct.set(String(product._id), {
      productId: String(product._id),
      productName: product.name,
      category: product.category || "General",
      currentStock: product.quantity || 0,
      unitPrice: product.price || 0,
      values: emptySeries,
      totalQuantity30d: 0,
      totalRevenue30d: 0,
      soldDays: 0,
      lastSoldAt: null,
      basis: "demo-assisted",
    });
  }

  for (const sale of sales) {
    const saleDateKey = toDateKey(sale.completedAt);
    const seriesIndex = dateIndex.get(saleDateKey);

    if (seriesIndex === undefined) {
      continue;
    }

    for (const item of sale.items || []) {
      const key = String(item.productId);
      const existing = historyByProduct.get(key);

      if (!existing) {
        continue;
      }

      existing.values[seriesIndex].quantity += item.quantity;
      existing.values[seriesIndex].revenue += item.lineTotal;
      existing.totalQuantity30d += item.quantity;
      existing.totalRevenue30d += item.lineTotal;
      existing.lastSoldAt = sale.completedAt;
    }
  }

  for (const product of products) {
    const key = String(product._id);
    const history = historyByProduct.get(key);
    history.soldDays = history.values.filter((entry) => entry.quantity > 0).length;

    if (history.soldDays >= 5 || history.totalQuantity30d >= 12) {
      history.basis = "live";
      continue;
    }

    const seeded = buildSeededHistory(product, dateKeys);
    history.values = history.values.map((entry, index) => ({
      ...entry,
      quantity: entry.quantity > 0 ? entry.quantity : seeded[index].quantity,
      revenue: entry.revenue > 0 ? entry.revenue : seeded[index].revenue,
    }));
    history.basis = "demo-assisted";
  }

  return Array.from(historyByProduct.values());
};

const computeConfidenceLocally = (seriesValues) => {
  const positiveDays = seriesValues.filter((value) => value.quantity > 0).length;
  const totalQuantity = seriesValues.reduce((sum, value) => sum + value.quantity, 0);

  if (positiveDays >= 12 && totalQuantity >= 40) {
    return "high";
  }

  if (positiveDays >= 6 && totalQuantity >= 15) {
    return "medium";
  }

  return "low";
};

export const forecastSeriesLocally = (series) => {
  const quantities = series.values.map((entry) => entry.quantity);
  const last7 = quantities.slice(-7);
  const last14 = quantities.slice(-14);
  const average = (values) =>
    values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;

  const avg7 = average(last7);
  const avg14 = average(last14);
  const avg30 = average(quantities);
  const points = quantities.length;

  let slope = 0;
  if (points > 1) {
    const meanX = (points - 1) / 2;
    const meanY = avg30;
    let numerator = 0;
    let denominator = 0;

    quantities.forEach((value, index) => {
      numerator += (index - meanX) * (value - meanY);
      denominator += (index - meanX) ** 2;
    });

    slope = denominator ? numerator / denominator : 0;
  }

  const predictedDailyDemand = Math.max(
    0,
    Number((avg7 * 0.5 + avg14 * 0.3 + avg30 * 0.2 + slope * 2).toFixed(2))
  );
  const predictedDemand7d = Math.max(
    0,
    Number((predictedDailyDemand * FORECAST_HORIZON_DAYS).toFixed(2))
  );
  const trendPercent = avg30
    ? Number((((avg7 - avg30) / avg30) * 100).toFixed(2))
    : predictedDailyDemand > 0
      ? 100
      : 0;

  return {
    product_id: series.productId,
    product_name: series.productName,
    predicted_daily_demand: predictedDailyDemand,
    predicted_demand_7d: predictedDemand7d,
    trend_percent: trendPercent,
    confidence: computeConfidenceLocally(series.values),
  };
};

const postJson = async (path, payload) => {
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    AI_REQUEST_TIMEOUT_MS
  );

  try {
    const response = await fetch(`${AI_SERVICE_URL}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`AI service request failed with ${response.status}`);
    }

    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
};

const requestForecasts = async (seriesPayload) => {
  try {
    const response = await postJson("/forecast", {
        horizon_days: FORECAST_HORIZON_DAYS,
        series: seriesPayload.map((series) => ({
          product_id: series.productId,
          product_name: series.productName,
          current_stock: series.currentStock,
          unit_price: series.unitPrice,
          basis: series.basis,
          values: series.values.map((value) => ({
            date: value.date,
            quantity: value.quantity,
            revenue: value.revenue,
          })),
        })),
      });

    return response?.results || [];
  } catch (error) {
    return seriesPayload.map((series) => forecastSeriesLocally(series));
  }
};

export const buildForecastItems = (products, seriesCollection, forecastResults) => {
  const resultMap = new Map(
    forecastResults.map((result) => [String(result.product_id), result])
  );
  const seriesMap = new Map(seriesCollection.map((series) => [series.productId, series]));

  return products.map((product) => {
    const key = String(product._id);
    const history = seriesMap.get(key);
    const result = resultMap.get(key) || forecastSeriesLocally(history);
    const currentStock = product.quantity || 0;
    const predictedDailyDemand = Number(result.predicted_daily_demand || 0);
    const daysToStockout =
      predictedDailyDemand > 0
        ? Number((currentStock / predictedDailyDemand).toFixed(1))
        : null;

    return {
      productId: key,
      productName: product.name,
      category: product.category || "General",
      currentStock,
      currentPrice: product.price || 0,
      predictedDailyDemand,
      predictedDemand7d: Number(result.predicted_demand_7d || 0),
      trendPercent: Number(result.trend_percent || 0),
      confidence: result.confidence || "low",
      basis: history?.basis || "demo-assisted",
      totalQuantity30d: history?.totalQuantity30d || 0,
      totalRevenue30d: history?.totalRevenue30d || 0,
      lastSoldAt: history?.lastSoldAt || null,
      soldDays: history?.soldDays || 0,
      daysToStockout,
    };
  });
};

export const buildRestockItem = (forecastItem, store) => {
  const leadTimeDays = store.settings?.leadTimeDays || DEFAULT_LEAD_TIME_DAYS;
  const safetyStock =
    store.settings?.safetyStockUnits || store.settings?.lowStockThreshold || 10;
  const recommendedStock = Math.ceil(
    forecastItem.predictedDailyDemand * leadTimeDays + safetyStock
  );
  const recommendedQty = Math.max(0, recommendedStock - forecastItem.currentStock);

  let priority = "green";
  if (
    forecastItem.currentStock === 0 ||
    (forecastItem.daysToStockout !== null &&
      forecastItem.daysToStockout <= leadTimeDays)
  ) {
    priority = "red";
  } else if (
    recommendedQty > 0 ||
    (forecastItem.daysToStockout !== null &&
      forecastItem.daysToStockout <= leadTimeDays * 2)
  ) {
    priority = "yellow";
  }

  let reorderDate = null;
  if (forecastItem.daysToStockout !== null) {
    const offsetDays = Math.max(
      0,
      Math.floor(forecastItem.daysToStockout - leadTimeDays)
    );
    const reorderAt = new Date();
    reorderAt.setHours(0, 0, 0, 0);
    reorderAt.setDate(reorderAt.getDate() + offsetDays);
    reorderDate = reorderAt.toISOString();
  }

  return {
    productId: forecastItem.productId,
    productName: forecastItem.productName,
    currentStock: forecastItem.currentStock,
    predictedDemand7d: forecastItem.predictedDemand7d,
    recommendedQty,
    recommendedStock,
    reorderDate,
    leadTimeDays,
    priority,
    daysToStockout: forecastItem.daysToStockout,
    basis: forecastItem.basis,
  };
};

export const detectAnomalies = (seriesCollection) => {
  const anomalies = [];

  for (const series of seriesCollection) {
    const quantities = series.values.map((entry) => entry.quantity);
    if (quantities.length < 8) {
      continue;
    }

    const recentAverage =
      quantities.slice(-7).reduce((sum, value) => sum + value, 0) / 7;
    const baseline = quantities.slice(0, -7);
    const baselineAverage =
      baseline.reduce((sum, value) => sum + value, 0) /
      Math.max(baseline.length, 1);
    const variance =
      baseline.reduce((sum, value) => sum + (value - baselineAverage) ** 2, 0) /
      Math.max(baseline.length, 1);
    const standardDeviation = Math.sqrt(variance);

    let direction = null;
    let score = 0;

    if (standardDeviation > 0) {
      score = (recentAverage - baselineAverage) / standardDeviation;
      if (score >= 2) {
        direction = "spike";
      } else if (score <= -2) {
        direction = "drop";
      }
    } else if (baselineAverage > 0) {
      const ratio = recentAverage / baselineAverage;
      if (ratio >= 1.5) {
        direction = "spike";
      } else if (ratio <= 0.5) {
        direction = "drop";
      }
    }

    if (!direction) {
      continue;
    }

    anomalies.push({
      productId: series.productId,
      productName: series.productName,
      direction,
      zScore: Number(score.toFixed(2)),
      recentAverage: Number(recentAverage.toFixed(2)),
      baselineAverage: Number(baselineAverage.toFixed(2)),
      basis: series.basis,
    });
  }

  return anomalies.sort((a, b) => Math.abs(b.zScore) - Math.abs(a.zScore));
};

export const buildInsights = ({
  forecastItems,
  restockItems,
  anomalies,
  products,
}) => {
  const insights = [];
  const topForecast = [...forecastItems]
    .sort((a, b) => b.predictedDemand7d - a.predictedDemand7d)
    .slice(0, 5);

  if (topForecast.length) {
    insights.push({
      type: "fastest_selling",
      title: "Fastest selling products",
      summary: `${topForecast[0].productName} is projected to lead next-week demand with ${topForecast[0].predictedDemand7d.toFixed(0)} units.`,
      severity: "info",
      metrics: topForecast.map((item) => ({
        productId: item.productId,
        productName: item.productName,
        predictedDemand7d: item.predictedDemand7d,
      })),
      basis: topForecast.some((item) => item.basis !== "live")
        ? "demo-assisted"
        : "live",
    });
  }

  const slowMovers = forecastItems
    .filter(
      (item) =>
        item.totalQuantity30d > 0 &&
        item.totalQuantity30d <= 5 &&
        item.currentStock > 0
    )
    .sort((a, b) => a.totalQuantity30d - b.totalQuantity30d)
    .slice(0, 5);

  if (slowMovers.length) {
    insights.push({
      type: "slow_moving",
      title: "Slow-moving inventory",
      summary: `${slowMovers[0].productName} sold only ${slowMovers[0].totalQuantity30d} units in the last 30 days.`,
      severity: "warning",
      metrics: slowMovers.map((item) => ({
        productId: item.productId,
        productName: item.productName,
        soldLast30Days: item.totalQuantity30d,
        currentStock: item.currentStock,
      })),
      basis: slowMovers.some((item) => item.basis !== "live")
        ? "demo-assisted"
        : "live",
    });
  }

  const deadStock = forecastItems
    .filter((item) => !item.lastSoldAt && item.currentStock > 0)
    .sort((a, b) => b.currentStock - a.currentStock)
    .slice(0, 5);

  const longIdle = forecastItems
    .filter(
      (item) =>
        item.lastSoldAt &&
        (Date.now() - new Date(item.lastSoldAt).getTime()) /
          (1000 * 60 * 60 * 24) >
          DEAD_STOCK_DAYS &&
        item.currentStock > 0
    )
    .slice(0, 5);

  const deadStockItems = [...deadStock, ...longIdle].slice(0, 5);
  if (deadStockItems.length) {
    insights.push({
      type: "dead_stock",
      title: "Dead stock detection",
      summary: `${deadStockItems[0].productName} has stock on hand but no meaningful recent sales activity.`,
      severity: "danger",
      metrics: deadStockItems.map((item) => ({
        productId: item.productId,
        productName: item.productName,
        currentStock: item.currentStock,
        lastSoldAt: item.lastSoldAt,
      })),
      basis: deadStockItems.some((item) => item.basis !== "live")
        ? "demo-assisted"
        : "live",
    });
  }

  if (anomalies.length) {
    const anomaly = anomalies[0];
    insights.push({
      type: anomaly.direction === "spike" ? "sales_spike" : "sales_drop",
      title:
        anomaly.direction === "spike"
          ? "Sudden demand spike alert"
          : "Sudden sales drop alert",
      summary: `${anomaly.productName} shows a ${anomaly.direction} versus its recent baseline.`,
      severity: anomaly.direction === "spike" ? "warning" : "danger",
      metrics: anomalies.slice(0, 5),
      basis: anomalies.some((item) => item.basis !== "live")
        ? "demo-assisted"
        : "live",
    });
  }

  const categoryStats = products.reduce((accumulator, product) => {
    const category = product.category || "General";

    if (!accumulator[category]) {
      accumulator[category] = {
        revenue: 0,
        stockValue: 0,
      };
    }

    const matchingForecast = forecastItems.find(
      (item) => item.productId === String(product._id)
    );
    accumulator[category].revenue += matchingForecast?.totalRevenue30d || 0;
    accumulator[category].stockValue +=
      (product.quantity || 0) * (product.price || 0);

    return accumulator;
  }, {});

  const totalRevenue = Object.values(categoryStats).reduce(
    (sum, value) => sum + value.revenue,
    0
  );
  const totalStockValue = Object.values(categoryStats).reduce(
    (sum, value) => sum + value.stockValue,
    0
  );

  const categoryMix = Object.entries(categoryStats)
    .map(([category, value]) => ({
      category,
      revenueShare: totalRevenue ? (value.revenue / totalRevenue) * 100 : 0,
      stockShare: totalStockValue ? (value.stockValue / totalStockValue) * 100 : 0,
    }))
    .sort(
      (a, b) =>
        Math.abs(b.revenueShare - b.stockShare) -
        Math.abs(a.revenueShare - a.stockShare)
    );

  if (categoryMix.length) {
    const dominant = categoryMix[0];
    insights.push({
      type: "category_mix",
      title: "Revenue versus stock mix",
      summary: `${dominant.category} contributes ${dominant.revenueShare.toFixed(0)}% of recent revenue versus ${dominant.stockShare.toFixed(0)}% of stock value.`,
      severity: "info",
      metrics: categoryMix.slice(0, 5),
      basis: forecastItems.some((item) => item.basis !== "live")
        ? "demo-assisted"
        : "live",
    });
  }

  const urgentRestock = restockItems
    .filter((item) => item.priority === "red")
    .slice(0, 5);
  if (urgentRestock.length) {
    insights.push({
      type: "restock_priority",
      title: "Urgent restock actions",
      summary: `${urgentRestock[0].productName} should be reordered immediately to avoid a stockout.`,
      severity: "danger",
      metrics: urgentRestock,
      basis: urgentRestock.some((item) => item.basis !== "live")
        ? "demo-assisted"
        : "live",
    });
  }

  return insights;
};

const buildExplanationFallback = ({ forecastItem, restockItem, product }) => {
  const demandText =
    forecastItem.predictedDemand7d > 0
      ? `${forecastItem.predictedDemand7d.toFixed(1)} units over the next 7 days`
      : "minimal near-term demand";
  const reorderText =
    restockItem.recommendedQty > 0
      ? `Reorder ${restockItem.recommendedQty} units within ${restockItem.leadTimeDays} day(s).`
      : "Current stock is sufficient for the expected demand window.";

  return {
    title: `${product.name} demand explanation`,
    summary: `${product.name} is trending ${forecastItem.trendPercent >= 0 ? "up" : "down"} with ${demandText}.`,
    recommendation: reorderText,
    basis: forecastItem.basis,
  };
};

const requestInsightExplanation = async ({
  product,
  forecastItem,
  restockItem,
}) => {
  try {
    const response = await postJson("/explain-insights", {
        insight_type: "product_detail",
        subject: product.name,
        basis: forecastItem.basis,
        metrics: {
          current_stock: forecastItem.currentStock,
          predicted_demand_7d: forecastItem.predictedDemand7d,
          predicted_daily_demand: forecastItem.predictedDailyDemand,
          trend_percent: forecastItem.trendPercent,
          recommended_reorder_qty: restockItem.recommendedQty,
          days_to_stockout: forecastItem.daysToStockout,
        },
      });

    return response;
  } catch (error) {
    return buildExplanationFallback({ forecastItem, restockItem, product });
  }
};

const loadAnalyticsContext = async (storeId, userId) => {
  const store = await assertStoreOwner(storeId, userId);
  const products = await Product.find({
    store: store._id,
    isActive: true,
  }).lean();

  const cutoffDate = new Date();
  cutoffDate.setHours(0, 0, 0, 0);
  cutoffDate.setDate(cutoffDate.getDate() - (LOOKBACK_DAYS - 1));

  const sales = await Sale.find({
    store: store._id,
    completedAt: { $gte: cutoffDate },
  }).lean();

  const dateKeys = buildDateWindow(LOOKBACK_DAYS);
  const seriesCollection = aggregateProductSeries(products, sales, dateKeys);
  const forecastResults = await requestForecasts(seriesCollection);
  const forecastItems = buildForecastItems(
    products,
    seriesCollection,
    forecastResults
  );
  const restockItems = forecastItems.map((item) =>
    buildRestockItem(item, store)
  );
  const anomalies = detectAnomalies(seriesCollection);
  const insights = buildInsights({
    forecastItems,
    restockItems,
    anomalies,
    products,
  });

  return {
    products,
    forecastItems,
    restockItems,
    insights,
  };
};

export const getStoreForecast = async (storeId, userId) => {
  const { forecastItems } = await loadAnalyticsContext(storeId, userId);
  return forecastItems.sort((a, b) => b.predictedDemand7d - a.predictedDemand7d);
};

export const getStoreRestockPlan = async (storeId, userId) => {
  const { restockItems } = await loadAnalyticsContext(storeId, userId);

  return restockItems.sort((a, b) => {
    const priorityRank = { red: 0, yellow: 1, green: 2 };
    return priorityRank[a.priority] - priorityRank[b.priority];
  });
};

export const getStoreInsights = async (storeId, userId) => {
  const { insights } = await loadAnalyticsContext(storeId, userId);
  return insights;
};

export const getProductInsightDetail = async (storeId, productId, userId) => {
  const { forecastItems, restockItems, insights, products } =
    await loadAnalyticsContext(storeId, userId);

  const product = products.find(
    (item) => String(item._id) === String(productId)
  );

  if (!product) {
    throw new ApiError("Product not found", 404);
  }

  const forecastItem = forecastItems.find(
    (item) => item.productId === String(productId)
  );
  const restockItem = restockItems.find(
    (item) => item.productId === String(productId)
  );
  const relatedInsights = insights.filter(
    (insight) =>
      Array.isArray(insight.metrics) &&
      insight.metrics.some(
        (metric) =>
          metric.productId === String(productId) ||
          metric.productName === product.name
      )
  );

  const explanation = await requestInsightExplanation({
    product,
    forecastItem,
    restockItem,
  });

  return {
    productId: String(product._id),
    productName: product.name,
    category: product.category || "General",
    forecast: forecastItem,
    restock: restockItem,
    explanation,
    relatedInsights,
  };
};
