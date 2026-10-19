import { Inventory, Product, Sale, Store, Cart, Purchase, Seller } from "../../models/index.js";
import { Types } from "mongoose";
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
  const [sales, products, lowStockCount, outOfStockCount] = await Promise.all([
    fetchSalesInRange(storeId, range),
    Product.find({ store: storeId }).select("buyingPrice isActive").lean(),
    Inventory.countDocuments({ store: storeId, isActive: true, isLowStock: true }),
    Inventory.countDocuments({ store: storeId, isActive: true, isOutOfStock: true }),
  ]);

  const totalProducts = products.filter(p => p.isActive).length;
  const productBuyingPriceMap = new Map(products.map(p => [String(p._id), p.buyingPrice]));

  let revenue = 0;
  let unitsSold = 0;
  let totalCost = 0;
  const soldProductIds = new Set();

  for (const sale of sales) {
    revenue += Number(sale.totalAmount || 0);

    for (const item of sale.items || []) {
      unitsSold += Number(item.quantity || 0);
      
      const fallbackBuyingPrice = item.productId ? (productBuyingPriceMap.get(String(item.productId)) || 0) : 0;
      const itemBuyingPrice = Number(item.unitBuyingPrice || 0);
      const actualUnitBuyingPrice = itemBuyingPrice > 0 ? itemBuyingPrice : Number(fallbackBuyingPrice || 0);
      
      totalCost += actualUnitBuyingPrice * Number(item.quantity || 0);

      if (item.productId) {
        soldProductIds.add(String(item.productId));
      }
    }
  }

  const orderCount = sales.length;
  const profit = revenue - totalCost;
  const margin = revenue > 0 ? (profit / revenue) * 100 : 0;

  return {
    range: {
      startDate: range.startDate,
      endDate: range.endDate,
      days: range.days,
    },
    cards: {
      revenue: round(revenue),
      profit: round(profit),
      margin: round(margin),
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

export const getStoreComprehensiveOverview = async (storeId) => {
  const storeObjectId = Types.ObjectId.isValid(storeId) ? new Types.ObjectId(storeId) : storeId;

  // 1. Fetch store, products, inventory docs, sales, carts, purchases, sellers in parallel
  const [store, products, inventoryDocs, sales, carts, purchases, sellers] = await Promise.all([
    Store.findById(storeId).lean(),
    Product.find({ store: storeObjectId, isActive: true }).lean(),
    Inventory.find({ store: storeObjectId, isActive: true }).populate("product").lean(),
    Sale.find({ store: storeObjectId }).lean(),
    Cart.find({ store: storeObjectId, status: "completed", paymentStatus: "paid" })
      .populate("products.product")
      .lean(),
    Purchase.find({ store: storeObjectId }).lean(),
    Seller.find({ store: storeObjectId }).lean(),
  ]);

  if (!store) {
    throw new ApiError("Store not found", 404);
  }

  // Combine sales from Sale model and Cart model
  const orderList = [];
  const processedCartIds = new Set();

  for (const s of sales) {
    if (s.cart) {
      processedCartIds.add(String(s.cart));
    }
    orderList.push({
      _id: s._id,
      amount: Number(s.totalAmount || 0),
      date: new Date(s.completedAt || s.createdAt || Date.now()),
      items: (s.items || []).map((it) => ({
        name: it.nameSnapshot || "Unknown Product",
        category: it.categorySnapshot || "General",
        quantity: Number(it.quantity || 0),
        unitPrice: Number(it.unitPrice || 0),
        lineTotal: Number(it.lineTotal || (it.unitPrice || 0) * (it.quantity || 0)),
      })),
    });
  }

  for (const c of carts) {
    if (!processedCartIds.has(String(c._id))) {
      orderList.push({
        _id: c._id,
        amount: Number(c.totalPrice || c.totalAmount || 0),
        date: new Date(c.completedAt || c.updatedAt || c.createdAt || Date.now()),
        items: (c.products || []).map((it) => ({
          name: it.product?.name || "Unknown Product",
          category: it.product?.category || "General",
          quantity: Number(it.quantity || 0),
          unitPrice: Number(it.price || it.product?.sellingPrice || 0),
          lineTotal: Number(it.price || it.product?.sellingPrice || 0) * Number(it.quantity || 0),
        })),
      });
    }
  }

  // --- Date boundaries ---
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const sevenDaysAgo = new Date(todayStart);
  sevenDaysAgo.setDate(todayStart.getDate() - 6);

  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthEnd = monthStart;

  const yearStart = new Date(now.getFullYear(), 0, 1);
  const nextYearStart = new Date(now.getFullYear() + 1, 0, 1);

  let todaySales = 0;
  let todayOrders = 0;
  let weeklySales = 0;
  let monthlySales = 0;
  let lastMonthSales = 0;
  let monthlyOrders = 0;
  let lastMonthOrders = 0;
  let yearlySales = 0;
  let totalSales = 0;

  const totalOrders = orderList.length;
  const productSalesMap = new Map();

  orderList.forEach((order) => {
    const oDate = order.date;
    const oAmount = order.amount;

    totalSales += oAmount;

    if (oDate >= todayStart) {
      todaySales += oAmount;
      todayOrders += 1;
    }

    if (oDate >= sevenDaysAgo) {
      weeklySales += oAmount;
    }

    if (oDate >= monthStart && oDate < nextMonthStart) {
      monthlySales += oAmount;
      monthlyOrders += 1;
    } else if (oDate >= lastMonthStart && oDate < lastMonthEnd) {
      lastMonthSales += oAmount;
      lastMonthOrders += 1;
    }

    if (oDate >= yearStart && oDate < nextYearStart) {
      yearlySales += oAmount;
    }

    // Product breakdown
    order.items.forEach((item) => {
      const pName = item.name;
      const existing = productSalesMap.get(pName) || {
        name: pName,
        unitsSold: 0,
        revenue: 0,
        quantity: 0,
      };
      existing.unitsSold += item.quantity;
      existing.quantity += item.quantity;
      existing.revenue += item.lineTotal;
      productSalesMap.set(pName, existing);
    });
  });

  const averageOrderValue = totalOrders > 0 ? Math.round(totalSales / totalOrders) : 0;
  const monthlyAov = monthlyOrders > 0 ? monthlySales / monthlyOrders : 0;
  const lastMonthAov = lastMonthOrders > 0 ? lastMonthSales / lastMonthOrders : 0;

  // Growth helper
  const getGrowth = (curr, prev) => {
    if (prev === 0) {
      if (curr === 0) {
        return { value: 0, isPositive: true, isNeutral: true, text: "0% from last month" };
      }
      return { value: 100, isPositive: true, isNeutral: false, text: "↑ 100% from last month" };
    }
    const diff = ((curr - prev) / prev) * 100;
    const rounded = Math.round(diff);
    if (rounded > 0) {
      return { value: rounded, isPositive: true, isNeutral: false, text: `↑ ${rounded}% from last month` };
    } else if (rounded < 0) {
      return { value: Math.abs(rounded), isPositive: false, isNeutral: false, text: `↓ ${Math.abs(rounded)}% from last month` };
    }
    return { value: 0, isPositive: true, isNeutral: true, text: "0% from last month" };
  };

  const salesGrowth = getGrowth(monthlySales, lastMonthSales);
  const ordersGrowth = getGrowth(monthlyOrders, lastMonthOrders);
  const aovGrowth = getGrowth(monthlyAov, lastMonthAov);

  // --- Charts: Daily (7 days), Weekly (4 weeks), Quarterly (4 quarters) ---
  const dailyBreakdown = [];
  const dailyLabels = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(todayStart);
    d.setDate(todayStart.getDate() - i);
    const startOfD = d.getTime();
    const endOfD = startOfD + 24 * 60 * 60 * 1000;
    const label = d.toLocaleDateString("en-IN", { weekday: "short" });
    dailyLabels.push(label);

    const daySum = orderList.reduce((sum, ord) => {
      const t = ord.date.getTime();
      return t >= startOfD && t < endOfD ? sum + ord.amount : sum;
    }, 0);
    dailyBreakdown.push(round(daySum));
  }

  const weeklyBreakdown = [0, 0, 0, 0];
  orderList.forEach((ord) => {
    if (ord.date >= monthStart && ord.date < nextMonthStart) {
      const dayOfMonth = ord.date.getDate();
      const weekIdx = dayOfMonth <= 7 ? 0 : dayOfMonth <= 14 ? 1 : dayOfMonth <= 21 ? 2 : 3;
      weeklyBreakdown[weekIdx] += ord.amount;
    }
  });
  const roundedWeeklyBreakdown = weeklyBreakdown.map((w) => round(w));

  const quarterlyBreakdown = [0, 0, 0, 0];
  orderList.forEach((ord) => {
    if (ord.date >= yearStart && ord.date < nextYearStart) {
      const qIdx = Math.floor(ord.date.getMonth() / 3);
      quarterlyBreakdown[qIdx] += ord.amount;
    }
  });
  const roundedQuarterlyBreakdown = quarterlyBreakdown.map((q) => round(q));

  // --- Inventory & Products ---
  const defaultLowThreshold = store.settings?.lowStockThreshold || 10;
  let totalQuantity = 0;
  let totalValue = 0;
  let totalCostValue = 0;
  let lowStockCount = 0;
  let outOfStockCount = 0;
  let inStockCount = 0;

  const criticalStockList = [];

  if (inventoryDocs && inventoryDocs.length > 0) {
    inventoryDocs.forEach((inv) => {
      const qty = Number(inv.quantity || 0);
      const sellPrice = Number(inv.sellingPrice ?? inv.product?.sellingPrice ?? 0);
      const buyPrice = Number(inv.product?.buyingPrice ?? 0);
      const minLevel = Number(inv.minStockLevel || defaultLowThreshold);

      totalQuantity += qty;
      totalValue += sellPrice * qty;
      totalCostValue += buyPrice * qty;

      if (qty === 0 || inv.isOutOfStock) {
        outOfStockCount++;
        criticalStockList.push({
          _id: inv.product?._id || inv._id,
          name: inv.product?.name || "Unknown Product",
          category: inv.product?.category || "General",
          quantity: qty,
          minStockLevel: minLevel,
        });
      } else if (qty <= minLevel || inv.isLowStock) {
        lowStockCount++;
        criticalStockList.push({
          _id: inv.product?._id || inv._id,
          name: inv.product?.name || "Unknown Product",
          category: inv.product?.category || "General",
          quantity: qty,
          minStockLevel: minLevel,
        });
      } else {
        inStockCount++;
      }
    });
  } else {
    products.forEach((prod) => {
      const qty = Number(prod.quantity || 0);
      const sellPrice = Number(prod.sellingPrice || 0);
      const buyPrice = Number(prod.buyingPrice || 0);
      const minLevel = defaultLowThreshold;

      totalQuantity += qty;
      totalValue += sellPrice * qty;
      totalCostValue += buyPrice * qty;

      if (qty === 0) {
        outOfStockCount++;
        criticalStockList.push({
          _id: prod._id,
          name: prod.name,
          category: prod.category || "General",
          quantity: qty,
          minStockLevel: minLevel,
        });
      } else if (qty <= minLevel) {
        lowStockCount++;
        criticalStockList.push({
          _id: prod._id,
          name: prod.name,
          category: prod.category || "General",
          quantity: qty,
          minStockLevel: minLevel,
        });
      } else {
        inStockCount++;
      }
    });
  }

  criticalStockList.sort((a, b) => a.quantity - b.quantity);

  const totalCategories = new Set(products.map((p) => p.category).filter(Boolean)).size;

  const topSellingList = [...productSalesMap.values()]
    .sort((a, b) => b.unitsSold - a.unitsSold)
    .slice(0, 10)
    .map((item) => ({
      ...item,
      revenue: round(item.revenue),
    }));

  const topProduct = topSellingList[0] || { name: "N/A", unitsSold: 0 };

  // --- Purchases Stats ---
  let totalPurchasesAmount = 0;
  let totalPurchasesDue = 0;
  let monthlyPurchases = 0;
  let monthlyPurchasesCount = 0;

  purchases.forEach((purch) => {
    const pDate = new Date(purch.purchaseDate || purch.createdAt || Date.now());
    const gTotal = Number(purch.grandTotal ?? purch.totalAmount ?? 0);
    const due = Number(purch.dueAmount || 0);

    totalPurchasesAmount += gTotal;
    totalPurchasesDue += due;

    if (pDate >= monthStart && pDate < nextMonthStart) {
      monthlyPurchases += gTotal;
      monthlyPurchasesCount += 1;
    }
  });

  // --- Sellers Stats ---
  let totalSellerDue = 0;
  let activeSellers = 0;

  sellers.forEach((seller) => {
    if (seller.status === "active") {
      activeSellers += 1;
    }
    totalSellerDue += Number(seller.totalDue || 0);
  });

  const resolvedDueToSellers = Math.max(totalSellerDue, totalPurchasesDue);

  return {
    store: {
      _id: store._id,
      name: store.name,
      businessType: store.businessType || "retail",
    },
    sales: {
      todaySales: round(todaySales),
      weeklySales: round(weeklySales),
      monthlySales: round(monthlySales),
      yearlySales: round(yearlySales),
      totalSales: round(totalSales),
      totalOrders,
      todayOrders,
      averageOrderValue,
      salesGrowth,
      ordersGrowth,
      aovGrowth,
      charts: {
        dailyBreakdown,
        dailyLabels,
        weeklyBreakdown: roundedWeeklyBreakdown,
        quarterlyBreakdown: roundedQuarterlyBreakdown,
      },
    },
    inventory: {
      totalQuantity,
      totalValue: round(totalValue),
      totalCostValue: round(totalCostValue),
      lowStockCount,
      outOfStockCount,
      inStockCount,
    },
    products: {
      totalProducts: products.length,
      totalCategories,
      topProduct: {
        name: topProduct.name,
        unitsSold: topProduct.unitsSold,
      },
      criticalStock: criticalStockList.slice(0, 15),
      topSelling: topSellingList,
    },
    purchases: {
      totalAmount: round(totalPurchasesAmount),
      dueAmount: round(totalPurchasesDue),
      totalPurchases: purchases.length,
      monthlyPurchases: round(monthlyPurchases),
      monthlyPurchasesCount,
    },
    sellers: {
      totalSellers: sellers.length,
      activeSellers,
      totalDue: round(resolvedDueToSellers),
    },
  };
};
