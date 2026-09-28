import mongoose from "mongoose";
import { Inventory, Product, Sale } from "../../models/index.js";
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
  const storeObjectId = mongoose.Types.ObjectId.isValid(storeId)
    ? new mongoose.Types.ObjectId(storeId)
    : storeId;

  const rows = await Sale.aggregate([
    { $match: { store: storeObjectId } },
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

export const getProductOverview = async (storeId, productId, range, options = {}) => {
  const page = options.page || 1;
  const limit = options.limit || 10;
  const previousStartDate = new Date(
    range.startDate.getTime() - range.days * 24 * 60 * 60 * 1000
  );

  const [product, inventory, sales] = await Promise.all([
    Product.findOne({
      _id: productId,
      store: storeId,
      isActive: true,
    })
      .select("name category price quantity unit sku barcode image expDate isActive")
      .lean(),
    Inventory.findOne({ store: storeId, product: productId, isActive: true })
      .select("minStockLevel isLowStock isOutOfStock")
      .lean(),
    Sale.find({
      store: storeId,
      completedAt: { $gte: previousStartDate, $lte: range.endDate },
      "items.productId": productId,
    })
      .select("_id user completedAt items")
      .lean(),
  ]);

  if (!product) {
    throw new ApiError("Product not found for this store", 404);
  }

  const dateKeys = buildDateKeys(range.startDate, range.endDate);
  const revenueByDate = new Map(dateKeys.map((key) => [key, 0]));
  const unitsByDate = new Map(dateKeys.map((key) => [key, 0]));
  const ordersByDate = new Map(dateKeys.map((key) => [key, 0]));

  const aggregateSales = (from, to, includeTrend = false) => {
    const result = {
      revenue: 0,
      units: 0,
      orders: 0,
      lastSoldAt: null,
    };

    for (const sale of sales) {
      const completedAt = new Date(sale.completedAt);
      if (completedAt < from || completedAt > to) {
        continue;
      }

      let saleRevenue = 0;
      let saleUnits = 0;
      for (const item of sale.items || []) {
        if (String(item.productId) !== String(productId)) {
          continue;
        }
        saleRevenue += Number(item.lineTotal || 0);
        saleUnits += Number(item.quantity || 0);
      }

      if (!saleUnits && !saleRevenue) {
        continue;
      }

      result.revenue += saleRevenue;
      result.units += saleUnits;
      result.orders += 1;
      result.lastSoldAt = !result.lastSoldAt || completedAt > new Date(result.lastSoldAt)
        ? sale.completedAt
        : result.lastSoldAt;

      if (includeTrend) {
        const key = toDateKey(sale.completedAt);
        revenueByDate.set(key, revenueByDate.get(key) + saleRevenue);
        unitsByDate.set(key, unitsByDate.get(key) + saleUnits);
        ordersByDate.set(key, ordersByDate.get(key) + 1);
      }
    }

    return result;
  };

  const current = aggregateSales(range.startDate, range.endDate, true);
  const previous = aggregateSales(previousStartDate, new Date(range.startDate.getTime() - 1), false);

  const currentStock = Number(product.quantity || 0);
  const averageDailyUnits = current.units / Math.max(range.days, 1);
  const stockCoverDays = averageDailyUnits > 0
    ? round(currentStock / averageDailyUnits)
    : null;
  const stockStatus = inventory
    ? inventory.isOutOfStock || currentStock === 0
      ? "Out of Stock"
      : inventory.isLowStock || currentStock <= Number(inventory.minStockLevel || 0)
        ? "Low Stock"
        : "Healthy"
    : null;
  const daysSinceLastSale = current.lastSoldAt
    ? Math.floor((Date.now() - new Date(current.lastSoldAt).getTime()) / (24 * 60 * 60 * 1000))
    : null;
  const performanceStatus = !current.lastSoldAt
    ? "No Recent Sales"
    : daysSinceLastSale >= 30
      ? "Slow Moving"
      : averageDailyUnits >= 1
        ? "Fast Moving"
        : "Normal Moving";
  const comparison = (currentValue, previousValue) => ({
    current: round(currentValue),
    previous: round(previousValue),
    percentageChange: previousValue === 0
      ? currentValue === 0 ? 0 : null
      : round(((currentValue - previousValue) / previousValue) * 100),
  });

  const transactionRows = sales
    .filter((sale) => {
      const completedAt = new Date(sale.completedAt);
      return completedAt >= range.startDate && completedAt <= range.endDate;
    })
    .map((sale) => {
      const item = (sale.items || []).find(
        (saleItem) => String(saleItem.productId) === String(productId)
      );
      if (!item) return null;
      return {
        id: sale._id,
        date: sale.completedAt,
        orderId: sale._id,
        quantity: Number(item.quantity || 0),
        sellingPrice: Number(item.unitPrice || 0),
        revenue: Number(item.lineTotal || 0),
        profit: null,
      };
    })
    .filter(Boolean);
  const transactionStart = (page - 1) * limit;
  const transactionItems = transactionRows.slice(transactionStart, transactionStart + limit);

  return {
    product: {
      id: product._id,
      name: product.name,
      category: normalizeCategory(product.category),
      sku: product.sku || null,
      barcode: product.barcode || null,
      image: product.image || null,
      price: Number(product.price || 0),
      currentPrice: Number(product.price || 0),
      currentStock,
      unit: product.unit || null,
      expiryDate: product.expDate || null,
      status: product.isActive ? "Active" : "Inactive",
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
        {
          key: "orders",
          label: "Orders",
          data: dateKeys.map((key) => ordersByDate.get(key)),
        },
      ],
    },
    summary: {
      totalRevenue: round(current.revenue),
      totalUnits: current.units,
      totalOrders: current.orders,
      averageSellingPrice: current.units ? round(current.revenue / current.units) : 0,
      averageUnitsPerOrder: current.orders ? round(current.units / current.orders) : 0,
      averageDailyUnits: round(averageDailyUnits),
      stockCoverDays,
      lastSoldAt: current.lastSoldAt,
      salesVelocity: round(averageDailyUnits),
    },
    profit: {
      totalRevenue: round(current.revenue),
      totalCost: null,
      grossProfit: null,
      profitMargin: null,
      averageProfitPerUnit: null,
      available: false,
      message: "Historical cost is not stored on sale items; accurate profit requires cost snapshots.",
    },
    stock: {
      currentStock,
      openingStock: null,
      unitsSold: current.units,
      restockedQuantity: null,
      stockAdjustments: null,
      closingStock: currentStock,
      averageDailySales: round(averageDailyUnits),
      stockCoverDays,
      status: stockStatus,
      minStockLevel: inventory?.minStockLevel ?? null,
      movementHistoryAvailable: false,
      movementMessage: "Stock movement analytics requires historical inventory movement data.",
    },
    comparison: {
      revenue: comparison(current.revenue, previous.revenue),
      units: comparison(current.units, previous.units),
      orders: comparison(current.orders, previous.orders),
      profit: null,
      averageSellingPrice: comparison(
        current.units ? current.revenue / current.units : 0,
        previous.units ? previous.revenue / previous.units : 0
      ),
    },
    performance: {
      status: performanceStatus,
      salesVelocity: round(averageDailyUnits),
      lastSoldAt: current.lastSoldAt,
    },
    expiry: product.expDate
      ? {
          expiryDate: product.expDate,
          daysRemaining: Math.ceil((new Date(product.expDate).getTime() - Date.now()) / (24 * 60 * 60 * 1000)),
          status: new Date(product.expDate) < new Date()
            ? "Expired"
            : Math.ceil((new Date(product.expDate).getTime() - Date.now()) / (24 * 60 * 60 * 1000)) <= 7
              ? "Expiring Soon"
              : "Safe",
          expiredQuantity: null,
        }
      : { available: false, message: "Expiry date is not available for this product." },
    transactions: {
      items: transactionItems,
      page,
      limit,
      total: transactionRows.length,
      totalPages: Math.ceil(transactionRows.length / limit),
    },
    insights: [
      current.revenue > previous.revenue && previous.revenue > 0
        ? "Revenue increased compared with the previous period."
        : null,
      performanceStatus === "No Recent Sales" ? "This product has no recent sales." : null,
      stockCoverDays !== null ? `Current stock may cover approximately ${stockCoverDays} days.` : null,
      stockStatus === "Low Stock" || stockStatus === "Out of Stock"
        ? "This product is approaching or below its configured stock threshold."
        : null,
    ].filter(Boolean),
  };
};
