import mongoose from 'mongoose';
import { Seller, Purchase, PurchaseReturn } from '../../models/index.js';

/**
 * Create a new seller for a store
 */
export const createSeller = async (storeId, data) => {
  const seller = await Seller.create({ ...data, store: storeId });
  return seller;
};

/**
 * Get all sellers for a store with search, filter, pagination
 */
export const getSellers = async (storeId, { search, status, page = 1, limit = 20 }) => {
  const query = { store: storeId };

  if (status && status !== 'all') {
    query.status = status;
  }

  if (search) {
    const regex = new RegExp(search, 'i');
    query.$or = [
      { name: regex },
      { businessName: regex },
      { phone: regex },
      { email: regex },
    ];
  }

  const skip = (Number(page) - 1) * Number(limit);

  const [sellers, total] = await Promise.all([
    Seller.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .lean(),
    Seller.countDocuments(query),
  ]);

  return {
    sellers,
    total,
    page: Number(page),
    totalPages: Math.ceil(total / Number(limit)),
  };
};

/**
 * Get a single seller by ID (must belong to the store)
 */
export const getSellerById = async (storeId, sellerId) => {
  if (!mongoose.Types.ObjectId.isValid(sellerId)) {
    throw Object.assign(new Error('Invalid seller ID'), { statusCode: 400 });
  }
  const seller = await Seller.findOne({ _id: sellerId, store: storeId }).lean();
  if (!seller) {
    throw Object.assign(new Error('Seller not found'), { statusCode: 404 });
  }
  return seller;
};

/**
 * Update seller details
 */
export const updateSeller = async (storeId, sellerId, data) => {
  if (!mongoose.Types.ObjectId.isValid(sellerId)) {
    throw Object.assign(new Error('Invalid seller ID'), { statusCode: 400 });
  }
  // Prevent changing store reference
  delete data.store;

  const seller = await Seller.findOneAndUpdate(
    { _id: sellerId, store: storeId },
    { $set: data },
    { new: true, runValidators: true }
  ).lean();

  if (!seller) {
    throw Object.assign(new Error('Seller not found'), { statusCode: 404 });
  }
  return seller;
};

/**
 * Delete a seller (only if no purchases are linked — soft approach: check totalPurchase)
 */
export const deleteSeller = async (storeId, sellerId) => {
  if (!mongoose.Types.ObjectId.isValid(sellerId)) {
    throw Object.assign(new Error('Invalid seller ID'), { statusCode: 400 });
  }
  const seller = await Seller.findOne({ _id: sellerId, store: storeId });
  if (!seller) {
    throw Object.assign(new Error('Seller not found'), { statusCode: 404 });
  }
  await seller.deleteOne();
  return { deleted: true };
};

/**
 * Get seller summary stats for the store
 */
export const getSellerStats = async (storeId) => {
  const stats = await Seller.aggregate([
    { $match: { store: new mongoose.Types.ObjectId(storeId) } },
    {
      $group: {
        _id: null,
        totalSellers: { $sum: 1 },
        activeSellers: { $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] } },
        totalPurchaseAmount: { $sum: '$totalPurchase' },
        totalPaid: { $sum: '$totalPaid' },
        totalDue: { $sum: '$totalDue' },
      },
    },
  ]);

  return stats[0] || {
    totalSellers: 0,
    activeSellers: 0,
    totalPurchaseAmount: 0,
    totalPaid: 0,
    totalDue: 0,
  };
};

/**
 * Get supplier purchase history with filtering, searching, and pagination
 */
export const getSellerPurchasesService = async (storeId, sellerId, query) => {
  const { 
    page = 1, 
    limit = 10, 
    search = '', 
    startDate, 
    endDate, 
    paymentStatus, 
    returnStatus 
  } = query;

  const filter = {
    store: new mongoose.Types.ObjectId(storeId),
    seller: new mongoose.Types.ObjectId(sellerId)
  };

  if (startDate || endDate) {
    filter.purchaseDate = {};
    if (startDate) filter.purchaseDate.$gte = new Date(startDate);
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      filter.purchaseDate.$lte = end;
    }
  }

  if (paymentStatus) {
    filter.paymentStatus = paymentStatus;
  }

  if (returnStatus) {
    if (returnStatus === 'No Return') filter.returnStatus = { $nin: ['Returned', 'Partially Returned'] };
    else filter.returnStatus = returnStatus;
  }

  if (search) {
    filter.invoiceNumber = new RegExp(search, 'i');
  }

  const skip = (Number(page) - 1) * Number(limit);

  const [purchases, total] = await Promise.all([
    Purchase.find(filter)
      .sort({ purchaseDate: -1, createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .lean(),
    Purchase.countDocuments(filter)
  ]);

  return {
    purchases,
    pagination: {
      total,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(total / Number(limit))
    }
  };
};

/**
 * Get supplier purchase summary (aggregations)
 */
export const getSellerPurchaseSummaryService = async (storeId, sellerId) => {
  const storeObjectId = new mongoose.Types.ObjectId(storeId);
  const sellerObjectId = new mongoose.Types.ObjectId(sellerId);

  // Get gross purchase stats
  const purchaseStats = await Purchase.aggregate([
    { $match: { store: storeObjectId, seller: sellerObjectId } },
    {
      $group: {
        _id: null,
        totalPurchase: { $sum: "$grandTotal" },
        amountPaid: { $sum: "$paidAmount" },
        amountDue: { $sum: "$dueAmount" },
        purchaseCount: { $sum: 1 }
      }
    }
  ]);

  // Get return stats
  const returnStats = await PurchaseReturn.aggregate([
    { $match: { store: storeObjectId, seller: sellerObjectId } },
    {
      $group: {
        _id: null,
        returnedAmount: { $sum: "$refundAmount" },
        returnCount: { $sum: 1 },
        returnedQuantity: { 
          $sum: {
            $sum: "$items.quantity"
          }
        }
      }
    }
  ]);

  const pStats = purchaseStats[0] || {
    totalPurchase: 0,
    amountPaid: 0,
    amountDue: 0,
    purchaseCount: 0
  };

  const rStats = returnStats[0] || {
    returnedAmount: 0,
    returnCount: 0,
    returnedQuantity: 0
  };

  const netPurchase = pStats.totalPurchase - rStats.returnedAmount;

  // Trend (last 6 months)
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
  sixMonthsAgo.setDate(1);

  const trendStats = await Purchase.aggregate([
    { 
      $match: { 
        store: storeObjectId, 
        seller: sellerObjectId,
        purchaseDate: { $gte: sixMonthsAgo }
      } 
    },
    {
      $group: {
        _id: { 
          year: { $year: "$purchaseDate" }, 
          month: { $month: "$purchaseDate" } 
        },
        total: { $sum: "$grandTotal" }
      }
    },
    { $sort: { "_id.year": 1, "_id.month": 1 } }
  ]);

  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const trend = trendStats.map(t => ({
    month: months[t._id.month - 1],
    year: t._id.year,
    purchase: t.total
  }));

  return {
    ...pStats,
    ...rStats,
    netPurchase,
    trend
  };
};
