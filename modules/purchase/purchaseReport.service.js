import mongoose from "mongoose";
import Purchase from "../../models/purchase.model.js";
import PurchaseReturn from "../../models/purchaseReturn.model.js";

export const generatePurchaseReport = async (storeId, query = {}) => {
  const { startDate, endDate, supplierId, productId, paymentStatus, returnStatus } = query;

  const matchStage = { store: new mongoose.Types.ObjectId(storeId) };

  if (startDate && endDate) {
    matchStage.purchaseDate = {
      $gte: new Date(startDate),
      $lte: new Date(endDate),
    };
  }

  if (supplierId) {
    matchStage.supplier = new mongoose.Types.ObjectId(supplierId);
  }

  if (paymentStatus) {
    matchStage.paymentStatus = paymentStatus;
  }

  if (returnStatus) {
    matchStage.returnStatus = returnStatus;
  }

  if (productId) {
    matchStage["items.product"] = new mongoose.Types.ObjectId(productId);
  }

  // Common pipeline to get base purchases with seller info
  const basePipeline = [
    { $match: matchStage },
    {
      $lookup: {
        from: "sellers",
        localField: "supplier",
        foreignField: "_id",
        as: "supplierDetails",
      },
    },
    { $unwind: { path: "$supplierDetails", preserveNullAndEmptyArrays: true } }
  ];

  // 1. Summary
  const summaryResult = await Purchase.aggregate([
    ...basePipeline,
    {
      $group: {
        _id: null,
        totalPurchase: { $sum: "$grandTotal" },
        purchaseOrders: { $sum: 1 },
        amountPaid: { $sum: "$paidAmount" },
        amountDue: { $sum: "$dueAmount" },
        returnedAmount: { $sum: "$returnedAmount" }
      }
    }
  ]);

  const summary = summaryResult[0] || {
    totalPurchase: 0,
    purchaseOrders: 0,
    amountPaid: 0,
    amountDue: 0,
    returnedAmount: 0
  };
  summary.netPurchase = summary.totalPurchase - summary.returnedAmount;
  summary.averagePurchase = summary.purchaseOrders > 0 ? (summary.netPurchase / summary.purchaseOrders) : 0;

  // 2. Transactions
  const transactions = await Purchase.aggregate([
    ...basePipeline,
    { $sort: { purchaseDate: -1 } },
    {
      $project: {
        invoiceNumber: 1,
        purchaseDate: 1,
        supplierName: "$supplierDetails.name",
        totalItems: { $size: "$items" },
        subTotal: 1,
        discountAmount: 1,
        taxAmount: 1,
        grandTotal: 1,
        paidAmount: 1,
        dueAmount: 1,
        returnedAmount: 1,
        paymentStatus: 1,
        returnStatus: 1
      }
    }
  ]);

  // 3. Supplier Report
  const supplierReport = await Purchase.aggregate([
    ...basePipeline,
    {
      $group: {
        _id: "$supplier",
        supplierName: { $first: "$supplierDetails.name" },
        purchaseOrders: { $sum: 1 },
        grossPurchase: { $sum: "$grandTotal" },
        paidAmount: { $sum: "$paidAmount" },
        dueAmount: { $sum: "$dueAmount" },
        returnedAmount: { $sum: "$returnedAmount" }
      }
    },
    {
      $addFields: {
        netPurchase: { $subtract: ["$grossPurchase", "$returnedAmount"] }
      }
    },
    { $sort: { grossPurchase: -1 } }
  ]);

  // 4. Product Report
  const productReport = await Purchase.aggregate([
    ...basePipeline,
    { $unwind: "$items" },
    {
      $group: {
        _id: "$items.product",
        purchasedQuantity: { $sum: "$items.quantity" },
        returnedQuantity: { $sum: "$items.returnedQuantity" },
        purchaseValue: { $sum: "$items.total" }
      }
    },
    {
      $lookup: {
        from: "products",
        localField: "_id",
        foreignField: "_id",
        as: "productDetails"
      }
    },
    { $unwind: { path: "$productDetails", preserveNullAndEmptyArrays: true } },
    {
      $project: {
        productName: "$productDetails.name",
        sku: "$productDetails.sku",
        purchasedQuantity: 1,
        returnedQuantity: 1,
        netQuantity: { $subtract: ["$purchasedQuantity", "$returnedQuantity"] },
        purchaseValue: 1
      }
    },
    { $sort: { purchaseValue: -1 } }
  ]);

  // 5. Monthly Report
  const monthlyReport = await Purchase.aggregate([
    ...basePipeline,
    {
      $group: {
        _id: {
          year: { $year: "$purchaseDate" },
          month: { $month: "$purchaseDate" }
        },
        purchaseOrders: { $sum: 1 },
        grossPurchase: { $sum: "$grandTotal" },
        returnedAmount: { $sum: "$returnedAmount" },
        paidAmount: { $sum: "$paidAmount" },
        dueAmount: { $sum: "$dueAmount" }
      }
    },
    {
      $addFields: {
        netPurchase: { $subtract: ["$grossPurchase", "$returnedAmount"] }
      }
    },
    { $sort: { "_id.year": -1, "_id.month": -1 } }
  ]);

  // 6. Return Report
  const returnMatchStage = { store: new mongoose.Types.ObjectId(storeId) };
  if (startDate && endDate) {
    returnMatchStage.returnDate = {
      $gte: new Date(startDate),
      $lte: new Date(endDate),
    };
  }
  if (supplierId) {
    returnMatchStage.supplier = new mongoose.Types.ObjectId(supplierId);
  }
  const returnReport = await PurchaseReturn.aggregate([
    { $match: returnMatchStage },
    {
      $lookup: {
        from: "purchases",
        localField: "purchase",
        foreignField: "_id",
        as: "purchaseDetails"
      }
    },
    { $unwind: { path: "$purchaseDetails", preserveNullAndEmptyArrays: true } },
    {
      $lookup: {
        from: "sellers",
        localField: "supplier",
        foreignField: "_id",
        as: "supplierDetails"
      }
    },
    { $unwind: { path: "$supplierDetails", preserveNullAndEmptyArrays: true } },
    { $unwind: "$items" },
    {
      $lookup: {
        from: "products",
        localField: "items.product",
        foreignField: "_id",
        as: "productDetails"
      }
    },
    { $unwind: { path: "$productDetails", preserveNullAndEmptyArrays: true } },
    {
      $project: {
        returnId: "$returnNumber",
        invoiceNumber: "$purchaseDetails.invoiceNumber",
        returnDate: 1,
        supplierName: "$supplierDetails.name",
        productName: "$productDetails.name",
        returnedQuantity: "$items.quantity",
        returnAmount: "$items.refundAmount",
        reason: "$items.reason",
        status: 1
      }
    },
    { $sort: { returnDate: -1 } }
  ]);

  // 7. Payment/Due Report (Filtered transactions where paymentStatus is not fully paid)
  // Actually, standard transactions include all, but we can return specifically for payment tab.
  const paymentReport = transactions.map(t => ({
    invoiceNumber: t.invoiceNumber,
    supplierName: t.supplierName,
    purchaseDate: t.purchaseDate,
    grandTotal: t.grandTotal,
    paidAmount: t.paidAmount,
    dueAmount: t.dueAmount,
    paymentStatus: t.paymentStatus
  }));

  return {
    summary,
    transactions,
    supplierReport,
    productReport,
    monthlyReport,
    returnReport,
    paymentReport
  };
};
