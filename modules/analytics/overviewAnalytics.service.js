import { Product, Inventory, Sale, Purchase, Seller, Cart } from "../../models/index.js";
import { assertStoreOwner } from "../store/storeAccess.service.js";

const round = (val, dec = 2) => {
  if (!Number.isFinite(val)) return 0;
  const factor = 10 ** dec;
  return Math.round(val * factor) / factor;
};

const calculateGrowth = (current = 0, previous = 0) => {
  if (previous === 0) {
    if (current === 0) {
      return { value: 0, isPositive: true, isNeutral: true, text: "0% from last month" };
    }
    return { value: 100, isPositive: true, isNeutral: false, text: "+100% from last month" };
  }
  const change = ((current - previous) / previous) * 100;
  const rounded = Math.round(change);
  if (rounded > 0) {
    return { value: rounded, isPositive: true, isNeutral: false, text: `+${rounded}% from last month` };
  } else if (rounded < 0) {
    return { value: Math.abs(rounded), isPositive: false, isNeutral: false, text: `-${Math.abs(rounded)}% from last month` };
  }
  return { value: 0, isPositive: true, isNeutral: true, text: "0% from last month" };
};

export const getStoreComprehensiveOverview = async (storeId, userId) => {
  // 1. Assert store exists and caller has access
  const store = await assertStoreOwner(storeId, userId);

  // 2. Query all resources in parallel
  const [products, rawSales, purchases, sellers, inventoryRecords] = await Promise.all([
    Product.find({ store: storeId, isActive: { $ne: false } }).lean(),
    Sale.find({ store: storeId }).sort({ completedAt: -1 }).lean(),
    Purchase.find({ store: storeId }).sort({ purchaseDate: -1 }).lean(),
    Seller.find({ store: storeId }).lean(),
    Inventory.find({ store: storeId, isActive: true }).lean(),
  ]);

  // If no Sale documents, fall back to completed Carts for backward compatibility
  let sales = rawSales;
  if (!sales || sales.length === 0) {
    const carts = await Cart.find({
      store: storeId,
      status: "completed",
    })
      .populate("products.product", "name category sellingPrice buyingPrice")
      .sort({ updatedAt: -1 })
      .lean();

    sales = carts.map((c) => ({
      _id: c._id,
      totalAmount: c.totalPrice || 0,
      dueAmount: 0,
      completedAt: c.updatedAt || c.createdAt || new Date(),
      items: (c.products || []).map((p) => ({
        productId: p.product?._id || p.product,
        nameSnapshot: p.product?.name || "Product",
        categorySnapshot: p.product?.category || "General",
        quantity: p.quantity || 0,
        unitPrice: p.price || p.product?.sellingPrice || 0,
        unitBuyingPrice: p.product?.buyingPrice || 0,
      })),
    }));
  }

  // --- A. PRODUCTS & INVENTORY METRICS ---
  const lowStockThreshold = Number(store.settings?.lowStockThreshold ?? 10);
  let totalStockQuantity = 0;
  let totalStockValueSelling = 0;
  let totalStockValueCost = 0;
  let outOfStockCount = 0;
  let lowStockCount = 0;
  let inStockCount = 0;

  const categoryMap = new Map();
  const criticalProducts = [];

  for (const p of products) {
    const qty = Number(p.quantity || 0);
    const sp = Number(p.sellingPrice || 0);
    const bp = Number(p.buyingPrice || 0);

    totalStockQuantity += qty;
    totalStockValueSelling += qty * sp;
    totalStockValueCost += qty * bp;

    if (qty <= 0) {
      outOfStockCount++;
      criticalProducts.push({
        _id: p._id,
        name: p.name,
        category: p.category || "General",
        quantity: qty,
        sellingPrice: sp,
        status: "out_of_stock",
      });
    } else if (qty <= lowStockThreshold) {
      lowStockCount++;
      criticalProducts.push({
        _id: p._id,
        name: p.name,
        category: p.category || "General",
        quantity: qty,
        sellingPrice: sp,
        status: "low_stock",
      });
    } else {
      inStockCount++;
    }

    const catName = (p.category || "General").trim();
    if (!categoryMap.has(catName)) {
      categoryMap.set(catName, { name: catName, productCount: 0, totalStock: 0 });
    }
    const catEntry = categoryMap.get(catName);
    catEntry.productCount += 1;
    catEntry.totalStock += qty;
  }

  criticalProducts.sort((a, b) => a.quantity - b.quantity);

  // --- B. SALES METRICS & CHARTS ---
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const sevenDaysAgo = new Date(todayStart);
  sevenDaysAgo.setDate(todayStart.getDate() - 6);

  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

  const thisYearStart = new Date(now.getFullYear(), 0, 1);

  let totalSalesAmount = 0;
  let totalSalesDue = 0;
  let todaySales = 0;
  let todayOrders = 0;
  let weeklySales = 0;
  let monthlySales = 0;
  let lastMonthSales = 0;
  let monthlyOrders = 0;
  let lastMonthOrders = 0;
  let yearlySales = 0;

  const productSalesMap = new Map();

  // Daily breakdown (last 7 days: 0..6)
  const dailyLabels = [];
  const dailyBreakdown = [0, 0, 0, 0, 0, 0, 0];
  const dayDates = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(todayStart);
    d.setDate(todayStart.getDate() - i);
    dayDates.push(d);
    dailyLabels.push(d.toLocaleDateString("en-IN", { weekday: "short" }));
  }

  // Monthly 4 weeks breakdown
  const weeklyBreakdown = [0, 0, 0, 0];

  // Quarterly breakdown
  const quarterlyBreakdown = [0, 0, 0, 0];

  for (const sale of sales) {
    const saleDate = new Date(sale.completedAt || sale.updatedAt || sale.createdAt);
    const amount = Number(sale.totalAmount ?? sale.totalPrice ?? 0);
    const due = Number(sale.dueAmount || 0);

    totalSalesAmount += amount;
    totalSalesDue += due;

    if (saleDate >= thisYearStart) {
      yearlySales += amount;
      const qIndex = Math.floor(saleDate.getMonth() / 3);
      if (qIndex >= 0 && qIndex < 4) {
        quarterlyBreakdown[qIndex] += amount;
      }
    }

    if (saleDate >= todayStart) {
      todaySales += amount;
      todayOrders += 1;
    }

    if (saleDate >= sevenDaysAgo) {
      weeklySales += amount;
      for (let i = 0; i < 7; i++) {
        const start = dayDates[i];
        const next = new Date(start);
        next.setDate(start.getDate() + 1);
        if (saleDate >= start && saleDate < next) {
          dailyBreakdown[i] += amount;
          break;
        }
      }
    }

    if (saleDate >= thisMonthStart && saleDate < nextMonthStart) {
      monthlySales += amount;
      monthlyOrders += 1;

      // Group into 4 weeks of the month
      const dayOfMonth = saleDate.getDate();
      const weekIdx = Math.min(3, Math.floor((dayOfMonth - 1) / 7));
      weeklyBreakdown[weekIdx] += amount;
    } else if (saleDate >= lastMonthStart && saleDate < thisMonthStart) {
      lastMonthSales += amount;
      lastMonthOrders += 1;
    }

    // Top selling products aggregation
    for (const item of sale.items || []) {
      const pName = (item.nameSnapshot || "Unknown Product").trim();
      const pQty = Number(item.quantity || 0);
      const pRevenue = Number(item.lineTotal || (item.unitPrice || 0) * pQty);

      if (!productSalesMap.has(pName)) {
        productSalesMap.set(pName, { name: pName, unitsSold: 0, revenue: 0 });
      }
      const pRecord = productSalesMap.get(pName);
      pRecord.unitsSold += pQty;
      pRecord.revenue += pRevenue;
    }
  }

  const totalOrders = sales.length;
  const aov = totalOrders > 0 ? Math.round(totalSalesAmount / totalOrders) : 0;
  const currentMonthAov = monthlyOrders > 0 ? Math.round(monthlySales / monthlyOrders) : 0;
  const lastMonthAov = lastMonthOrders > 0 ? Math.round(lastMonthSales / lastMonthOrders) : 0;

  const topProductsList = Array.from(productSalesMap.values())
    .sort((a, b) => b.unitsSold - a.unitsSold)
    .slice(0, 5);

  const topProduct = topProductsList[0] || { name: "N/A", unitsSold: 0, revenue: 0 };

  // --- C. PURCHASES METRICS ---
  let totalPurchasesAmount = 0;
  let totalPurchasesPaid = 0;
  let totalPurchasesDue = 0;
  let monthlyPurchasesAmount = 0;
  let monthlyPurchasesCount = 0;

  for (const pur of purchases) {
    const pDate = new Date(pur.purchaseDate || pur.createdAt);
    const gTotal = Number(pur.grandTotal || 0);
    const paid = Number(pur.paidAmount || 0);
    const due = Number(pur.dueAmount || 0);

    totalPurchasesAmount += gTotal;
    totalPurchasesPaid += paid;
    totalPurchasesDue += due;

    if (pDate >= thisMonthStart && pDate < nextMonthStart) {
      monthlyPurchasesAmount += gTotal;
      monthlyPurchasesCount += 1;
    }
  }

  // --- D. SELLERS METRICS ---
  const totalSellers = sellers.length;
  const activeSellers = sellers.filter((s) => s.status !== "inactive").length;
  const totalSellerDue = sellers.reduce((sum, s) => sum + Number(s.totalDue || 0), 0);

  // Return formatted, clean, structured overview
  return {
    store: {
      id: store._id,
      name: store.name,
      currency: store.currency || "INR",
      currencySymbol: "₹",
      lowStockThreshold,
    },
    inventory: {
      totalQuantity: totalStockQuantity,
      totalValue: round(totalStockValueSelling),
      totalCostValue: round(totalStockValueCost),
      lowStockCount,
      outOfStockCount,
      inStockCount,
      totalTrackedRecords: inventoryRecords.length || products.length,
    },
    products: {
      totalProducts: products.length,
      totalCategories: categoryMap.size,
      categories: Array.from(categoryMap.values()),
      criticalStock: criticalProducts.slice(0, 5),
      topProduct: {
        name: topProduct.name,
        unitsSold: topProduct.unitsSold,
        revenue: round(topProduct.revenue),
      },
      topSelling: topProductsList.map((tp) => ({
        ...tp,
        revenue: round(tp.revenue),
      })),
    },
    sales: {
      totalSales: round(totalSalesAmount),
      totalOrders,
      averageOrderValue: round(aov),
      todaySales: round(todaySales),
      todayOrders,
      weeklySales: round(weeklySales),
      monthlySales: round(monthlySales),
      yearlySales: round(yearlySales),
      totalDue: round(totalSalesDue),
      salesGrowth: calculateGrowth(monthlySales, lastMonthSales),
      ordersGrowth: calculateGrowth(monthlyOrders, lastMonthOrders),
      aovGrowth: calculateGrowth(currentMonthAov, lastMonthAov),
      charts: {
        dailyBreakdown: dailyBreakdown.map((v) => round(v)),
        dailyLabels,
        weeklyBreakdown: weeklyBreakdown.map((v) => round(v)),
        quarterlyBreakdown: quarterlyBreakdown.map((v) => round(v)),
      },
    },
    purchases: {
      totalPurchases: purchases.length,
      totalAmount: round(totalPurchasesAmount),
      paidAmount: round(totalPurchasesPaid),
      dueAmount: round(totalPurchasesDue),
      monthlyPurchases: round(monthlyPurchasesAmount),
      monthlyPurchasesCount,
    },
    sellers: {
      totalSellers,
      activeSellers,
      totalDue: round(totalSellerDue || totalPurchasesDue),
    },
  };
};
