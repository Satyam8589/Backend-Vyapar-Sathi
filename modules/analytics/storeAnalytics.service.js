import { Inventory, Product, Sale } from "../../models/index.js";

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

const fetchSalesInRange = async (storeId, range) => {
  return Sale.find({
    store: storeId,
    completedAt: {
      $gte: range.startDate,
      $lte: range.endDate,
    },
  }).lean();
};

const normalizeCategoryName = (name) => {
  if (!name || typeof name !== "string") {
    return "General";
  }

  const trimmed = name.trim();
  return trimmed || "General";
};

export const getStoreSummary = async (storeId, range) => {
  const [sales, totalProducts, lowStockCount, outOfStockCount] = await Promise.all([
    fetchSalesInRange(storeId, range),
    Product.countDocuments({ store: storeId, isActive: true }),
    Inventory.countDocuments({ store: storeId, isActive: true, isLowStock: true }),
    Inventory.countDocuments({ store: storeId, isActive: true, isOutOfStock: true }),
  ]);

  let revenue = 0;
  let unitsSold = 0;
  const soldProductIds = new Set();

  for (const sale of sales) {
    revenue += Number(sale.totalAmount || 0);

    for (const item of sale.items || []) {
      unitsSold += Number(item.quantity || 0);
      if (item.productId) {
        soldProductIds.add(String(item.productId));
      }
    }
  }

  const orderCount = sales.length;

  return {
    range: {
      startDate: range.startDate,
      endDate: range.endDate,
      days: range.days,
    },
    cards: {
      revenue: round(revenue),
      unitsSold,
      orderCount,
      averageOrderValue: orderCount ? round(revenue / orderCount) : 0,
      activeProducts: totalProducts,
      productsSold: soldProductIds.size,
      lowStockCount,
      outOfStockCount,
    },
  };
};

export const getStoreTrend = async (storeId, range) => {
  const [sales, activeProducts] = await Promise.all([
    fetchSalesInRange(storeId, range),
    Product.countDocuments({ store: storeId, isActive: true }),
  ]);

  const dateKeys = buildDateKeys(range.startDate, range.endDate);
  const revenueByDate = new Map(dateKeys.map((key) => [key, 0]));
  const unitsByDate = new Map(dateKeys.map((key) => [key, 0]));
  const ordersByDate = new Map(dateKeys.map((key) => [key, 0]));

  for (const sale of sales) {
    const key = toDateKey(sale.completedAt);

    if (!revenueByDate.has(key)) {
      continue;
    }

    revenueByDate.set(key, revenueByDate.get(key) + Number(sale.totalAmount || 0));
    ordersByDate.set(key, ordersByDate.get(key) + 1);

    let saleUnits = 0;
    for (const item of sale.items || []) {
      saleUnits += Number(item.quantity || 0);
    }
    unitsByDate.set(key, unitsByDate.get(key) + saleUnits);
  }

  const revenueSeries = dateKeys.map((key) => round(revenueByDate.get(key)));
  const unitsSeries = dateKeys.map((key) => unitsByDate.get(key));
  const ordersSeries = dateKeys.map((key) => ordersByDate.get(key));

  const totalRevenue = revenueSeries.reduce((sum, value) => sum + value, 0);
  const totalUnits = unitsSeries.reduce((sum, value) => sum + value, 0);
  const totalOrders = ordersSeries.reduce((sum, value) => sum + value, 0);

  return {
    range: {
      startDate: range.startDate,
      endDate: range.endDate,
      days: range.days,
    },
    chart: {
      labels: dateKeys,
      datasets: [
        { key: "revenue", label: "Revenue", data: revenueSeries },
        { key: "units", label: "Units Sold", data: unitsSeries },
        { key: "orders", label: "Orders", data: ordersSeries },
      ],
    },
    summary: {
      totalRevenue: round(totalRevenue),
      totalUnits,
      totalOrders,
      averageDailyRevenue: round(totalRevenue / Math.max(range.days, 1)),
      averageDailyOrders: round(totalOrders / Math.max(range.days, 1)),
      activeProducts,
    },
  };
};

export const getStoreCategoryPerformance = async (storeId, range, options = {}) => {
  const limit = options.limit || 8;
  const sales = await fetchSalesInRange(storeId, range);

  const categoryMap = new Map();

  for (const sale of sales) {
    for (const item of sale.items || []) {
      const category = normalizeCategoryName(item.categorySnapshot);
      const current = categoryMap.get(category) || {
        category,
        revenue: 0,
        unitsSold: 0,
        lineItems: 0,
      };

      current.revenue += Number(item.lineTotal || 0);
      current.unitsSold += Number(item.quantity || 0);
      current.lineItems += 1;

      categoryMap.set(category, current);
    }
  }

  const categories = [...categoryMap.values()]
    .map((item) => ({
      ...item,
      revenue: round(item.revenue),
      averageUnitPrice: item.unitsSold ? round(item.revenue / item.unitsSold) : 0,
    }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, limit);

  return {
    range: {
      startDate: range.startDate,
      endDate: range.endDate,
      days: range.days,
    },
    chart: {
      labels: categories.map((item) => item.category),
      datasets: [
        {
          key: "categoryRevenue",
          label: "Revenue by Category",
          data: categories.map((item) => item.revenue),
        },
        {
          key: "categoryUnits",
          label: "Units by Category",
          data: categories.map((item) => item.unitsSold),
        },
      ],
    },
    rows: categories,
    meta: {
      totalCategories: categoryMap.size,
      limit,
    },
  };
};
