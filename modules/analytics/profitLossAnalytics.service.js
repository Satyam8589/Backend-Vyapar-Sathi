import { Types } from "mongoose";
import { Sale, Expense } from "../../models/index.js";

export const getProfitLossSummary = async (storeId, { startDate, endDate }) => {
  const storeObjectId = new Types.ObjectId(storeId);

  const salesAgg = await Sale.aggregate([
    {
      $match: {
        store: storeObjectId,
        completedAt: { $gte: startDate, $lte: endDate },
        status: { $ne: 'Cancelled' } // Assuming 'Cancelled' is a status, otherwise remove this or adapt
      },
    },
    { $unwind: "$items" },
    {
      $group: {
        _id: null,
        totalRevenue: { $sum: "$items.lineTotal" },
        totalCOGS: { $sum: { $multiply: ["$items.unitBuyingPrice", "$items.quantity"] } },
      }
    }
  ]);

  const expensesAgg = await Expense.aggregate([
    {
      $match: {
        store: storeObjectId,
        date: { $gte: startDate, $lte: endDate },
      },
    },
    {
      $group: {
        _id: null,
        totalExpenses: { $sum: "$amount" }
      }
    }
  ]);

  const totalRevenue = salesAgg.length > 0 ? salesAgg[0].totalRevenue : 0;
  const totalCOGS = salesAgg.length > 0 ? salesAgg[0].totalCOGS : 0;
  const totalExpenses = expensesAgg.length > 0 ? expensesAgg[0].totalExpenses : 0;

  const grossProfit = totalRevenue - totalCOGS;
  const netProfit = grossProfit - totalExpenses;
  const profitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

  return {
    totalRevenue,
    totalCOGS,
    grossProfit,
    totalExpenses,
    netProfit,
    profitMargin: Number(profitMargin.toFixed(2))
  };
};

export const getProductWiseProfit = async (storeId, { startDate, endDate }) => {
  const storeObjectId = new Types.ObjectId(storeId);

  const productsAgg = await Sale.aggregate([
    {
      $match: {
        store: storeObjectId,
        completedAt: { $gte: startDate, $lte: endDate },
        status: { $ne: 'Cancelled' }
      },
    },
    { $unwind: "$items" },
    {
      $group: {
        _id: "$items.productId",
        productName: { $first: "$items.nameSnapshot" },
        quantitySold: { $sum: "$items.quantity" },
        revenue: { $sum: "$items.lineTotal" },
        cogs: { $sum: { $multiply: ["$items.unitBuyingPrice", "$items.quantity"] } },
      }
    },
    {
      $project: {
        _id: 1,
        productName: 1,
        quantitySold: 1,
        revenue: 1,
        cogs: 1,
        profit: { $subtract: ["$revenue", "$cogs"] },
        profitMargin: {
          $cond: [
            { $gt: ["$revenue", 0] },
            { $multiply: [{ $divide: [{ $subtract: ["$revenue", "$cogs"] }, "$revenue"] }, 100] },
            0
          ]
        }
      }
    },
    { $sort: { profit: -1 } }
  ]);

  // Round profitMargin for all items
  const formattedProducts = productsAgg.map(p => ({
    ...p,
    profitMargin: Number(p.profitMargin.toFixed(2))
  }));

  const topSelling = [...formattedProducts].sort((a, b) => b.quantitySold - a.quantitySold).slice(0, 5);
  const mostProfitable = [...formattedProducts].slice(0, 5); // Already sorted by profit desc
  const lowProfit = [...formattedProducts].reverse().slice(0, 5);

  return {
    products: formattedProducts,
    topSelling,
    mostProfitable,
    lowProfit
  };
};
