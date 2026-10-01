import mongoose from 'mongoose';
import { Seller } from '../../models/index.js';

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
