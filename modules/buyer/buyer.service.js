import mongoose from 'mongoose';
import { Buyer, Sale, Store } from '../../models/index.js';
import { sendInvoiceEmail } from '../../utils/mailer.js';

/**
 * Helper to recalculate and persist buyer totals on Buyer document
 */
const recalculateBuyerTotals = async (storeId, buyerId, phone) => {
  try {
    const matchConditions = [];
    if (buyerId && mongoose.Types.ObjectId.isValid(buyerId)) {
      matchConditions.push({ buyer: new mongoose.Types.ObjectId(buyerId) });
    }
    if (phone && phone !== 'N/A' && phone.trim() !== '') {
      matchConditions.push({ customerPhone: phone.trim() });
    }
    if (matchConditions.length === 0) return;

    const salesStats = await Sale.aggregate([
      {
        $match: {
          store: new mongoose.Types.ObjectId(storeId),
          $or: matchConditions,
        },
      },
      {
        $group: {
          _id: null,
          totalSales: { $sum: '$totalAmount' },
          totalPaid: { $sum: { $ifNull: ['$paidAmount', '$totalAmount'] } },
          totalDue: { $sum: { $ifNull: ['$dueAmount', 0] } },
        },
      },
    ]);

    const totalSales = salesStats[0]?.totalSales || 0;
    const totalPaid = salesStats[0]?.totalPaid || 0;
    const totalDue = salesStats[0]?.totalDue || 0;

    const query = { store: storeId };
    if (buyerId && mongoose.Types.ObjectId.isValid(buyerId)) {
      query._id = buyerId;
    } else {
      query.phone = phone.trim();
    }

    await Buyer.updateOne(query, {
      $set: { totalSales, totalPaid, totalDue },
    });
  } catch (err) {
    console.warn('[BUYER SERVICE] Failed to recalculate buyer totals:', err.message);
  }
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

  const [buyersDocs, total] = await Promise.all([
    Buyer.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .lean(),
    Buyer.countDocuments(query),
  ]);

  if (buyersDocs.length === 0) {
    return {
      buyers: [],
      total: 0,
      page: Number(page),
      totalPages: 0,
    };
  }

  const buyerIds = buyersDocs.map((b) => b._id);
  const buyerPhones = buyersDocs.map((b) => b.phone).filter((p) => p && p !== 'N/A');

  let salesAggregation = [];
  try {
    salesAggregation = await Sale.aggregate([
      {
        $match: {
          store: new mongoose.Types.ObjectId(storeId),
          $or: [
            { buyer: { $in: buyerIds } },
            { customerPhone: { $in: buyerPhones } },
          ],
        },
      },
      {
        $group: {
          _id: { $ifNull: ["$buyer", "$customerPhone"] },
          buyer: { $first: "$buyer" },
          customerPhone: { $first: "$customerPhone" },
          computedTotalSales: { $sum: "$totalAmount" },
          computedTotalPaid: { $sum: { $ifNull: ["$paidAmount", "$totalAmount"] } },
          computedTotalDue: { $sum: { $ifNull: ["$dueAmount", 0] } },
        },
      },
    ]);
  } catch (aggErr) {
    console.warn("[BUYER SERVICE] Aggregation failed:", aggErr.message);
  }

  const salesMapByBuyerId = new Map();
  const salesMapByPhone = new Map();

  salesAggregation.forEach((item) => {
    if (item.buyer) salesMapByBuyerId.set(item.buyer.toString(), item);
    if (item.customerPhone) salesMapByPhone.set(item.customerPhone, item);
  });

  const buyers = buyersDocs.map((b) => {
    const stats = salesMapByBuyerId.get(b._id.toString()) || salesMapByPhone.get(b.phone);
    const totalSales = stats ? stats.computedTotalSales : 0;
    const totalPaid = stats ? stats.computedTotalPaid : 0;
    const totalDue = stats ? stats.computedTotalDue : 0;
    return {
      ...b,
      totalSales,
      totalPaid,
      totalDue,
    };
  });

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

  try {
    const salesStats = await Sale.aggregate([
      {
        $match: {
          store: new mongoose.Types.ObjectId(storeId),
          $or: [
            { buyer: new mongoose.Types.ObjectId(buyerId) },
            ...(buyer.phone ? [{ customerPhone: buyer.phone }] : []),
          ],
        },
      },
      {
        $group: {
          _id: null,
          totalSales: { $sum: '$totalAmount' },
          totalPaid: { $sum: { $ifNull: ['$paidAmount', '$totalAmount'] } },
          totalDue: { $sum: { $ifNull: ['$dueAmount', 0] } },
        },
      },
    ]);

    if (salesStats.length > 0) {
      buyer.totalSales = salesStats[0].totalSales;
      buyer.totalPaid = salesStats[0].totalPaid;
      buyer.totalDue = salesStats[0].totalDue;
    } else {
      buyer.totalSales = 0;
      buyer.totalPaid = 0;
      buyer.totalDue = 0;
    }
  } catch (err) {
    console.warn("[BUYER SERVICE] Failed to aggregate buyer stats:", err.message);
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
  await Sale.updateMany({ store: storeId, buyer: buyerId }, { $unset: { buyer: "" } });
  await buyer.deleteOne();
  return { deleted: true };
};

/**
 * Get buyer summary stats for the store
 */
export const getBuyerStats = async (storeId) => {
  const storeObjectId = new mongoose.Types.ObjectId(storeId);

  const [buyerGroup, saleGroup] = await Promise.all([
    Buyer.aggregate([
      { $match: { store: storeObjectId } },
      {
        $group: {
          _id: null,
          totalBuyers: { $sum: 1 },
          activeBuyers: { $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] } },
        },
      },
    ]),
    Sale.aggregate([
      { $match: { store: storeObjectId } },
      {
        $group: {
          _id: null,
          totalSalesAmount: { $sum: '$totalAmount' },
          totalPaid: { $sum: { $ifNull: ['$paidAmount', '$totalAmount'] } },
          totalDue: { $sum: { $ifNull: ['$dueAmount', 0] } },
        },
      },
    ]),
  ]);

  const bStats = buyerGroup[0] || { totalBuyers: 0, activeBuyers: 0 };
  const sStats = saleGroup[0] || { totalSalesAmount: 0, totalPaid: 0, totalDue: 0 };

  return {
    totalBuyers: bStats.totalBuyers,
    activeBuyers: bStats.activeBuyers,
    totalSalesAmount: sStats.totalSalesAmount,
    totalPaid: sStats.totalPaid,
    totalDue: sStats.totalDue,
  };
};

/**
 * Get all purchases/transactions for a specific buyer
 */
export const getBuyerPurchases = async (storeId, buyerId) => {
  const buyer = await getBuyerById(storeId, buyerId);

  const query = {
    store: new mongoose.Types.ObjectId(storeId),
    $or: [
      { buyer: new mongoose.Types.ObjectId(buyerId) },
      ...(buyer.phone ? [{ customerPhone: buyer.phone }] : []),
    ],
  };

  const purchases = await Sale.find(query)
    .populate('store')
    .sort({ completedAt: -1, createdAt: -1 })
    .lean();

  const totalSales = purchases.reduce((sum, p) => sum + (p.totalAmount || 0), 0);
  const totalPaid = purchases.reduce((sum, p) => sum + (p.paidAmount ?? p.totalAmount ?? 0), 0);
  const totalDue = purchases.reduce((sum, p) => sum + (p.dueAmount || 0), 0);

  return {
    buyer: {
      ...buyer,
      totalSales,
      totalPaid,
      totalDue,
    },
    purchases,
    totalSales,
    totalPaid,
    totalDue,
    totalPurchases: purchases.length,
  };
};

/**
 * Get sale details by sale ID
 */
export const getSaleById = async (storeId, saleId) => {
  if (!mongoose.Types.ObjectId.isValid(saleId)) {
    throw Object.assign(new Error('Invalid sale ID'), { statusCode: 400 });
  }

  const sale = await Sale.findOne({
    _id: new mongoose.Types.ObjectId(saleId),
    store: new mongoose.Types.ObjectId(storeId),
  })
    .populate('store')
    .lean();

  if (!sale) {
    throw Object.assign(new Error('Sale transaction not found'), { statusCode: 404 });
  }

  return sale;
};

/**
 * Update a sale transaction (e.g. payment status, paid amount, payment mode)
 */
export const updateSaleTransaction = async (storeId, saleId, updateData) => {
  if (!mongoose.Types.ObjectId.isValid(saleId)) {
    throw Object.assign(new Error('Invalid sale ID'), { statusCode: 400 });
  }

  const sale = await Sale.findOne({ _id: saleId, store: storeId });
  if (!sale) {
    throw Object.assign(new Error('Sale transaction not found'), { statusCode: 404 });
  }

  if (updateData.paidAmount !== undefined) {
    sale.paidAmount = Math.max(0, Number(updateData.paidAmount));
    sale.dueAmount = Math.max(0, sale.totalAmount - sale.paidAmount);
    if (sale.paidAmount >= sale.totalAmount) {
      sale.paymentStatus = 'paid';
    } else if (sale.paidAmount > 0) {
      sale.paymentStatus = 'partial';
    } else {
      sale.paymentStatus = 'unpaid';
    }
  }

  if (updateData.paymentStatus) {
    sale.paymentStatus = updateData.paymentStatus;
    if (updateData.paymentStatus === 'paid') {
      sale.paidAmount = sale.totalAmount;
      sale.dueAmount = 0;
    } else if (updateData.paymentStatus === 'unpaid') {
      sale.paidAmount = 0;
      sale.dueAmount = sale.totalAmount;
    }
  }

  if (updateData.paymentMethod) {
    sale.paymentId = `${updateData.paymentMethod}-${Date.now()}`;
  }

  await sale.save();

  if (sale.buyer || sale.customerPhone) {
    await recalculateBuyerTotals(storeId, sale.buyer, sale.customerPhone);
  }

  return sale;
};

/**
 * Delete a sale transaction
 */
export const deleteSaleTransaction = async (storeId, saleId) => {
  if (!mongoose.Types.ObjectId.isValid(saleId)) {
    throw Object.assign(new Error('Invalid sale ID'), { statusCode: 400 });
  }

  const sale = await Sale.findOne({ _id: saleId, store: storeId });
  if (!sale) {
    throw Object.assign(new Error('Sale transaction not found'), { statusCode: 404 });
  }

  const buyerId = sale.buyer;
  const customerPhone = sale.customerPhone;

  await sale.deleteOne();

  if (buyerId || customerPhone) {
    await recalculateBuyerTotals(storeId, buyerId, customerPhone);
  }

  return { deleted: true };
};

/**
 * Create or update a buyer for a store
 */
export const createBuyer = async (storeId, data) => {
  let existing = null;

  if (data.buyerId || data._id) {
    existing = await Buyer.findOne({ _id: data.buyerId || data._id, store: storeId });
  }

  if (!existing && data.phone && data.phone !== 'N/A' && data.phone.trim() !== '') {
    existing = await Buyer.findOne({ store: storeId, phone: data.phone.trim() });
  }

  if (existing) {
    if (data.name && data.name !== 'Walk-in Customer') existing.name = data.name.trim();
    if (data.email) existing.email = data.email.trim();
    if (data.address) existing.address = data.address.trim();
    if (data.GSTIN) existing.GSTIN = data.GSTIN.trim();
    if (data.totalSales) existing.totalSales = (existing.totalSales || 0) + Number(data.totalSales);
    if (data.totalPaid) existing.totalPaid = (existing.totalPaid || 0) + Number(data.totalPaid);
    if (data.totalDue !== undefined) existing.totalDue = (existing.totalDue || 0) + Number(data.totalDue);
    await existing.save();
    return existing;
  }

  const buyer = await Buyer.create({ ...data, store: storeId });
  return buyer;
};

/**
 * Send bill email to buyer/customer for a sale transaction
 */
export const sendSaleEmailTransaction = async (storeId, saleId, targetEmail, pdfBase64 = null) => {
  if (!mongoose.Types.ObjectId.isValid(saleId)) {
    throw Object.assign(new Error('Invalid sale ID'), { statusCode: 400 });
  }

  const sale = await Sale.findOne({ _id: saleId, store: storeId }).populate('buyer');
  if (!sale) {
    throw Object.assign(new Error('Sale transaction not found'), { statusCode: 404 });
  }

  const storeObj = await Store.findById(storeId).lean();
  const toEmail = (targetEmail || sale.customerEmail || sale.buyer?.email || '').trim();

  if (!toEmail) {
    throw Object.assign(new Error('No email address available for this buyer. Please update buyer info with a valid email.'), { statusCode: 400 });
  }

  const saleObj = sale.toObject();
  const billData = {
    ...saleObj,
    _id: saleObj._id?.toString(),
    store: saleObj.store?.toString?.() ?? saleObj.store,
    buyer: saleObj.buyer?._id?.toString?.() ?? saleObj.buyer?.toString?.() ?? saleObj.buyer,
    storeInfo: storeObj || {},
  };

  await sendInvoiceEmail(toEmail, billData, {}, pdfBase64);

  return { success: true, email: toEmail };
};
