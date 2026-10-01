import mongoose from 'mongoose';
import { Buyer } from '../../models/index.js';

/**
 * Create a new buyer for a store
 */
export const createBuyer = async (storeId, data) => {
  const buyer = await Buyer.create({ ...data, store: storeId });
  return buyer;
};

/**
 * Get all buyers for a store with search, filter, pagination
 */
export const getBuyers = async (storeId, { search, status, page = 1, limit = 20 }) => {
  const query = { store: storeId };

  if (status && status !== 'all') {
    query.status = status;
  }

  if (search) {
    const regex = new RegExp(search, 'i');
    query.$or = [
      { name: regex },
      { phone: regex },
      { email: regex },
    ];
  }

  const skip = (Number(page) - 1) * Number(limit);

  const [buyers, total] = await Promise.all([
    Buyer.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .lean(),
    Buyer.countDocuments(query),
  ]);

  return {
    buyers,
    total,
    page: Number(page),
    totalPages: Math.ceil(total / Number(limit)),
  };
};

/**
 * Get a single buyer by ID (must belong to the store)
 */
export const getBuyerById = async (storeId, buyerId) => {
  if (!mongoose.Types.ObjectId.isValid(buyerId)) {
    throw Object.assign(new Error('Invalid buyer ID'), { statusCode: 400 });
  }
  const buyer = await Buyer.findOne({ _id: buyerId, store: storeId }).lean();
  if (!buyer) {
    throw Object.assign(new Error('Buyer not found'), { statusCode: 404 });
  }
  return buyer;
};

/**
 * Update buyer details
 */
export const updateBuyer = async (storeId, buyerId, data) => {
  if (!mongoose.Types.ObjectId.isValid(buyerId)) {
    throw Object.assign(new Error('Invalid buyer ID'), { statusCode: 400 });
  }
  delete data.store;

  const buyer = await Buyer.findOneAndUpdate(
    { _id: buyerId, store: storeId },
    { $set: data },
    { new: true, runValidators: true }
  ).lean();

  if (!buyer) {
    throw Object.assign(new Error('Buyer not found'), { statusCode: 404 });
  }
  return buyer;
};

/**
 * Delete a buyer
 */
export const deleteBuyer = async (storeId, buyerId) => {
  if (!mongoose.Types.ObjectId.isValid(buyerId)) {
    throw Object.assign(new Error('Invalid buyer ID'), { statusCode: 400 });
  }
  const buyer = await Buyer.findOne({ _id: buyerId, store: storeId });
  if (!buyer) {
    throw Object.assign(new Error('Buyer not found'), { statusCode: 404 });
  }
  await buyer.deleteOne();
  return { deleted: true };
};

/**
 * Get buyer summary stats for the store
 */
export const getBuyerStats = async (storeId) => {
  const stats = await Buyer.aggregate([
    { $match: { store: new mongoose.Types.ObjectId(storeId) } },
    {
      $group: {
        _id: null,
        totalBuyers: { $sum: 1 },
        activeBuyers: { $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] } },
        totalSalesAmount: { $sum: '$totalSales' },
        totalPaid: { $sum: '$totalPaid' },
        totalDue: { $sum: '$totalDue' },
      },
    },
  ]);

  return stats[0] || {
    totalBuyers: 0,
    activeBuyers: 0,
    totalSalesAmount: 0,
    totalPaid: 0,
    totalDue: 0,
  };
};
