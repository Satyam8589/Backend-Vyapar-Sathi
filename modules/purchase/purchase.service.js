import Purchase from "../../models/purchase.model.js";
import Product from "../../models/product.model.js";
import { ApiError } from "../../utils/ApiError.js";

export const createPurchase = async (purchaseData, storeId) => {
  const { items } = purchaseData;
  
  if (!items || items.length === 0) {
    throw new ApiError("Purchase must have at least one item", 400);
  }

  // Calculate totals if not provided correctly, but assuming provided for now.
  const purchase = new Purchase({
    ...purchaseData,
    store: storeId
  });

  const savedPurchase = await purchase.save();

  // Update product stock
  for (const item of items) {
    await Product.findByIdAndUpdate(item.product, {
      $inc: { stock: item.quantity }
    });
  }

  return savedPurchase;
};

export const getPurchases = async (storeId, query) => {
  const { page = 1, limit = 10, search, startDate, endDate, seller, paymentStatus } = query;
  
  const filter = { store: storeId };
  
  if (search) {
    filter.invoiceNumber = { $regex: search, $options: 'i' };
  }
  if (startDate || endDate) {
    filter.purchaseDate = {};
    if (startDate) filter.purchaseDate.$gte = new Date(startDate);
    if (endDate) filter.purchaseDate.$lte = new Date(endDate);
  }
  if (seller) {
    filter.seller = seller;
  }
  if (paymentStatus) {
    filter.paymentStatus = paymentStatus;
  }

  const skip = (page - 1) * limit;

  const purchases = await Purchase.find(filter)
    .populate('seller', 'name email phone')
    .populate('items.product', 'name sku currentPrice')
    .sort({ purchaseDate: -1 })
    .skip(skip)
    .limit(parseInt(limit));

  const total = await Purchase.countDocuments(filter);

  return {
    purchases,
    total,
    page: parseInt(page),
    totalPages: Math.ceil(total / limit)
  };
};

export const getPurchaseById = async (purchaseId, storeId) => {
  const purchase = await Purchase.findOne({ _id: purchaseId, store: storeId })
    .populate('seller', 'name email phone address gstNumber')
    .populate('items.product', 'name sku hsn currentPrice tax');
    
  if (!purchase) {
    throw new ApiError("Purchase not found", 404);
  }
  
  return purchase;
};

export const updatePurchase = async (purchaseId, updateData, storeId) => {
  const purchase = await Purchase.findOne({ _id: purchaseId, store: storeId });
  
  if (!purchase) {
    throw new ApiError("Purchase not found", 404);
  }

  if (updateData.paidAmount !== undefined) {
    purchase.paidAmount = updateData.paidAmount;
    purchase.dueAmount = Math.max(0, purchase.grandTotal - purchase.paidAmount);
    if (purchase.paidAmount >= purchase.grandTotal) {
      purchase.paymentStatus = 'paid';
    } else if (purchase.paidAmount > 0) {
      purchase.paymentStatus = 'partial';
    } else {
      purchase.paymentStatus = 'unpaid';
    }
  }

  if (updateData.paymentStatus !== undefined) {
    purchase.paymentStatus = updateData.paymentStatus;
  }
  
  if (updateData.notes !== undefined) {
    purchase.notes = updateData.notes;
  }

  if (updateData.invoiceNumber !== undefined) {
    purchase.invoiceNumber = updateData.invoiceNumber;
  }

  await purchase.save();
  return purchase;
};

export const deletePurchase = async (purchaseId, storeId) => {
  const purchase = await Purchase.findOne({ _id: purchaseId, store: storeId });
  
  if (!purchase) {
    throw new ApiError("Purchase not found", 404);
  }

  // Revert product stock
  for (const item of purchase.items) {
    await Product.findByIdAndUpdate(item.product, {
      $inc: { stock: -item.quantity, quantity: -item.quantity }
    });
  }

  await purchase.deleteOne();
  return { message: "Purchase deleted successfully" };
};
