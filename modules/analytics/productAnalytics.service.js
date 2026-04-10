import { Product, Sale } from "../../models/index.js";
import { ApiError } from "../../utils/ApiError.js";

const round = (value, precision = 2) => {
  if (!Number.isFinite(value)) {
    return 0;
  }
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
};

const toDateKey = (value) => {
  const date = new Date(value);
  return [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, "0"),
    String(date.getUTCDate()).padStart(2, "0"),
  ].join("-");
};

const buildDateKeys = (startDate, endDate) => {
  const keys = [];
  const current = new Date(startDate);

  while (current <= endDate) {
    keys.push(toDateKey(current));
    current.setUTCDate(current.getUTCDate() + 1);
  }

  return keys;
};

const getProductLastSoldMap = async (storeId) => {
  const rows = await Sale.aggregate([
    { $match: { store: storeId } },
    { $unwind: "$items" },
    {
      $group: {
        _id: "$items.productId",
        lastSoldAt: { $max: "$completedAt" },
      },
    },
  ]);

  return rows.reduce((acc, row) => {
    acc.set(String(row._id), row.lastSoldAt);
    return acc;
  }, new Map());
};

const buildUrgency = (daysSinceLastSale, inactivityDays) => {
  if (daysSinceLastSale >= inactivityDays * 2) {
    return "high";
  }
  if (daysSinceLastSale >= inactivityDays) {
    return "medium";
  }
  return "low";
};

const normalizeCategory = (value) => {
  if (!value || typeof value !== "string") {
    return "General";
  }

  const trimmed = value.trim();
  return trimmed || "General";
};

export const getTopProducts = async (storeId, range, options = {}) => {
  const limit = options.limit || 10;
  const sortBy = options.sortBy || "revenue";
  const categoryFilter = options.category ? String(options.category).trim() : "";

  const sales = await Sale.find({
    store: storeId,
    completedAt: {
      $gte: range.startDate,
      $lte: range.endDate,
    },
  }).lean();

  const productMap = new Map();

  for (const sale of sales) {
    for (const item of sale.items || []) {
      const category = normalizeCategory(item.categorySnapshot);

      if (categoryFilter && category.toLowerCase() !== categoryFilter.toLowerCase()) {
        continue;
      }

      const productId = String(item.productId);
      const current = productMap.get(productId) || {
        productId,
        productName: item.nameSnapshot || "Unnamed Product",
        category,
        revenue: 0,
        unitsSold: 0,
        orderCount: 0,
        lastSoldAt: sale.completedAt,
      };

      current.revenue += Number(item.lineTotal || 0);
      current.unitsSold += Number(item.quantity || 0);
      current.orderCount += 1;
      current.lastSoldAt = current.lastSoldAt > sale.completedAt ? current.lastSoldAt : sale.completedAt;

      productMap.set(productId, current);
    }
  }

  const sortAccessor = {
    revenue: (entry) => entry.revenue,
    units: (entry) => entry.unitsSold,
    orders: (entry) => entry.orderCount,
  };

  const metricKey = sortAccessor[sortBy] ? sortBy : "revenue";

  const rows = [...productMap.values()]
    .map((entry) => ({
      ...entry,
      revenue: round(entry.revenue),
      averageUnitPrice: entry.unitsSold ? round(entry.revenue / entry.unitsSold) : 0,
    }))
    .sort((a, b) => sortAccessor[metricKey](b) - sortAccessor[metricKey](a))
    .slice(0, limit);

  return {
    range: {
      startDate: range.startDate,
      endDate: range.endDate,
      days: range.days,
    },
    metric: metricKey,
    chart: {
      labels: rows.map((row) => row.productName),
      datasets: [
        {
          key: "productRevenue",
          label: "Revenue",
          data: rows.map((row) => row.revenue),
        },
        {
          key: "productUnits",
          label: "Units Sold",
          data: rows.map((row) => row.unitsSold),
        },
      ],
    },
    rows,
    meta: {
      totalProducts: productMap.size,
      limit,
      categoryFilter: categoryFilter || null,
    },
  };
};

export const getSlowMovingProducts = async (storeId, options = {}) => {
  const inactivityDays = options.inactivityDays || 30;
  const limit = options.limit || 20;

  const products = await Product.find({
    store: storeId,
    isActive: true,
  })
    .select("name category quantity updatedAt")
    .lean();

  const lastSoldMap = await getProductLastSoldMap(storeId);
  const now = Date.now();
  const thresholdMs = inactivityDays * 24 * 60 * 60 * 1000;

  const rows = [];

  for (const product of products) {
    const lastSoldAt = lastSoldMap.get(String(product._id)) || null;

    const fallbackDate = product.updatedAt || new Date(0);
    const referenceDate = lastSoldAt || fallbackDate;
    const daysSinceLastSale = Math.floor((now - new Date(referenceDate).getTime()) / (24 * 60 * 60 * 1000));

    if (daysSinceLastSale < inactivityDays) {
      continue;
    }

    rows.push({
      productId: product._id,
      productName: product.name,
      category: normalizeCategory(product.category),
      currentStock: Number(product.quantity || 0),
      lastSoldAt,
      daysSinceLastSale,
      urgency: buildUrgency(daysSinceLastSale, inactivityDays),
    });
  }

  rows.sort((a, b) => b.daysSinceLastSale - a.daysSinceLastSale);

  const limitedRows = rows.slice(0, limit);

  return {
    criteria: {
      inactivityDays,
      evaluatedProducts: products.length,
      thresholdDate: new Date(now - thresholdMs),
    },
    chart: {
      labels: limitedRows.map((row) => row.productName),
      datasets: [
        {
          key: "daysSinceLastSale",
          label: "Days Since Last Sale",
          data: limitedRows.map((row) => row.daysSinceLastSale),
        },
        {
          key: "currentStock",
          label: "Current Stock",
          data: limitedRows.map((row) => row.currentStock),
        },
      ],
    },
    rows: limitedRows,
    meta: {
      totalSlowMoving: rows.length,
      limit,
    },
  };
};

export const getProductOverview = async (storeId, productId, range) => {
  const product = await Product.findOne({
    _id: productId,
    store: storeId,
    isActive: true,
  })
    .select("name category price quantity")
    .lean();

  if (!product) {
    throw new ApiError("Product not found for this store", 404);
  }

  const sales = await Sale.find({
    store: storeId,
    completedAt: {
      $gte: range.startDate,
      $lte: range.endDate,
    },
    "items.productId": productId,
  }).lean();

  const dateKeys = buildDateKeys(range.startDate, range.endDate);
  const revenueByDate = new Map(dateKeys.map((key) => [key, 0]));
  const unitsByDate = new Map(dateKeys.map((key) => [key, 0]));

  let totalRevenue = 0;
  let totalUnits = 0;
  let totalOrders = 0;
  let lastSoldAt = null;

  for (const sale of sales) {
    let saleHasProduct = false;
    let saleRevenue = 0;
    let saleUnits = 0;

    for (const item of sale.items || []) {
      if (String(item.productId) !== String(productId)) {
        continue;
      }

      saleHasProduct = true;
      saleRevenue += Number(item.lineTotal || 0);
      saleUnits += Number(item.quantity || 0);
    }

    if (!saleHasProduct) {
      continue;
    }

    const key = toDateKey(sale.completedAt);
    if (revenueByDate.has(key)) {
      revenueByDate.set(key, revenueByDate.get(key) + saleRevenue);
      unitsByDate.set(key, unitsByDate.get(key) + saleUnits);
    }

    totalRevenue += saleRevenue;
    totalUnits += saleUnits;
    totalOrders += 1;
    lastSoldAt = !lastSoldAt || new Date(sale.completedAt) > new Date(lastSoldAt)
      ? sale.completedAt
      : lastSoldAt;
  }

  const averageDailyUnits = totalUnits / Math.max(range.days, 1);
  const stockCoverDays = averageDailyUnits > 0
    ? round(Number(product.quantity || 0) / averageDailyUnits)
    : null;

  return {
    product: {
      id: product._id,
      name: product.name,
      category: normalizeCategory(product.category),
      currentPrice: Number(product.price || 0),
      currentStock: Number(product.quantity || 0),
    },
    range: {
      startDate: range.startDate,
      endDate: range.endDate,
      days: range.days,
    },
    chart: {
      labels: dateKeys,
      datasets: [
        {
          key: "revenue",
          label: "Revenue",
          data: dateKeys.map((key) => round(revenueByDate.get(key))),
        },
        {
          key: "units",
          label: "Units Sold",
          data: dateKeys.map((key) => unitsByDate.get(key)),
        },
      ],
    },
    summary: {
      totalRevenue: round(totalRevenue),
      totalUnits,
      totalOrders,
      averageDailyUnits: round(averageDailyUnits),
      stockCoverDays,
      lastSoldAt,
      salesVelocity: round(averageDailyUnits),
    },
  };
};
