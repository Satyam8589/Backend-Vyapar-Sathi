import mongoose from "mongoose";
import Purchase from "../../models/purchase.model.js";
import PurchaseReturn from "../../models/purchaseReturn.model.js";
import Product from "../../models/product.model.js";
import Inventory from "../../models/inventory.model.js";
import { ApiError } from "../../utils/ApiError.js";
import { createNotificationService, checkInventoryAlertsService } from "../notification/notification.service.js";

/**
 * Increment product stock after a purchase.
 * Mirrors the decrementInventory pattern in sale.service.js.
 * Updates both Product.quantity (primary) and Inventory.quantity (secondary).
 */
const incrementInventory = async (items, storeId, session = null) => {
  const errors = [];

  for (const item of items) {
    const qtyToAdd = Number(item.quantity);
    try {
      // 1. Atomically increment Product.quantity
      const opts = session ? { session, new: true } : { new: true };
      const updatedProduct = await Product.findByIdAndUpdate(
        item.product,
        { $inc: { quantity: qtyToAdd } },
        opts
      );

      // 2. Sync Inventory record if one exists — best-effort, same as sale.service.js
      try {
        const inv = await Inventory.findOne({ store: storeId, product: item.product });
        if (inv) {
          inv.quantity = updatedProduct?.quantity ?? (inv.quantity + qtyToAdd);
          if (session) {
            await inv.save({ session });
          } else {
            await inv.save();
          }
          await checkInventoryAlertsService(storeId, item.product, inv.quantity, inv.minStockLevel || 10);
        } else {
          // If no Inventory doc, fallback to 10 as reorder level
          await checkInventoryAlertsService(storeId, item.product, updatedProduct.quantity, 10);
        }
      } catch (invErr) {
        console.warn("[PURCHASE SERVICE] Could not sync Inventory record:", invErr.message);
      }
    } catch (err) {
      errors.push({ productId: item.product, error: err.message });
    }
  }

  return errors;
};

/**
 * Decrement product stock when a purchase is deleted (reversal).
 * Also used internally by createPurchaseReturn — pass session for atomicity.
 */
const decrementInventory = async (items, storeId, session = null) => {
  for (const item of items) {
    const qtyToSubtract = Number(item.quantity);
    try {
      const opts = session ? { session, new: true } : { new: true };
      const updatedProduct = await Product.findByIdAndUpdate(
        item.product,
        { $inc: { quantity: -qtyToSubtract } },
        opts
      );

      try {
        const inv = await Inventory.findOne({ store: storeId, product: item.product });
        if (inv) {
          inv.quantity = Math.max(0, updatedProduct?.quantity ?? (inv.quantity - qtyToSubtract));
          if (session) {
            await inv.save({ session });
          } else {
            await inv.save();
          }
          await checkInventoryAlertsService(storeId, item.product, inv.quantity, inv.minStockLevel || 10);
        } else {
          await checkInventoryAlertsService(storeId, item.product, updatedProduct.quantity, 10);
        }
      } catch (invErr) {
        console.warn("[PURCHASE SERVICE] Could not sync Inventory record on delete:", invErr.message);
      }
    } catch (err) {
      console.error("[PURCHASE SERVICE] Stock revert error:", err.message);
    }
  }
};

export const createPurchase = async (purchaseData, storeId) => {
  const { items } = purchaseData;

  if (!items || items.length === 0) {
    throw new ApiError("Purchase must have at least one item", 400);
  }

  // Validate every item has a valid product ref and quantity > 0
  for (const item of items) {
    if (!item.product) {
      throw new ApiError("Each item must have a valid product reference", 400);
    }
    const qty = Number(item.quantity);
    if (!qty || qty <= 0 || !isFinite(qty)) {
      throw new ApiError("All item quantities must be greater than 0", 400);
    }
  }

  const productIds = items.map((item) => item.product);
  const uniqueProductIds = [...new Set(productIds.map(String))];

  // Security: verify every product is active and belongs to this store
  const storeProducts = await Product.find({
    _id: { $in: productIds },
    store: storeId,
    isActive: true
  }).select("_id");

  if (storeProducts.length !== uniqueProductIds.length) {
    throw new ApiError(
      "One or more products are invalid, inactive, or do not belong to this store",
      400
    );
  }

  // Save the Purchase document first (unique index on store+invoiceNumber prevents duplicates)
  const purchase = new Purchase({
    ...purchaseData,
    store: storeId
  });

  const savedPurchase = await purchase.save();

  // Increment stock — after purchase is persisted
  const stockErrors = await incrementInventory(items, storeId);

  if (stockErrors.length > 0) {
    console.error("[PURCHASE SERVICE] Partial stock update errors:", stockErrors);
  }

  // Generate success notification
  await createNotificationService({
    storeId,
    type: 'PURCHASE_CREATED',
    title: 'Purchase Created',
    message: `Purchase ${savedPurchase.invoiceNumber} created successfully.`,
    relatedEntityType: 'Purchase',
    relatedEntityId: savedPurchase._id,
    priority: 'LOW'
  });

  // Generate payment due notification if applicable
  if (savedPurchase.dueAmount > 0) {
    await createNotificationService({
      storeId,
      type: 'PURCHASE_DUE',
      title: 'Payment Due',
      message: `₹${savedPurchase.dueAmount} due for Purchase ${savedPurchase.invoiceNumber}.`,
      relatedEntityType: 'Purchase',
      relatedEntityId: savedPurchase._id,
      priority: 'MEDIUM'
    });
  }

  return {
    ...savedPurchase.toObject(),
    stockUpdated: stockErrors.length === 0
  };
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
    .populate('items.product', 'name sku hsn currentPrice tax quantity');
    
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

  let diffItems = [];
  if (updateData.items) {
    // Validate items
    for (const item of updateData.items) {
      if (!item.product) throw new ApiError("Each item must have a valid product reference", 400);
      const qty = Number(item.quantity);
      if (!qty || qty <= 0 || !isFinite(qty)) throw new ApiError("All item quantities must be greater than 0", 400);
    }

    const productIds = updateData.items.map((item) => item.product);
    const uniqueProductIds = [...new Set(productIds.map(String))];
    const storeProducts = await Product.find({ _id: { $in: productIds }, store: storeId, isActive: true }).select("_id");
    if (storeProducts.length !== uniqueProductIds.length) {
      throw new ApiError("One or more products are invalid, inactive, or do not belong to this store", 400);
    }

    const oldItems = purchase.items || [];
    const newItems = updateData.items || [];

    const qtyDiff = {}; 
    oldItems.forEach(item => {
      const pid = item.product.toString();
      qtyDiff[pid] = (qtyDiff[pid] || 0) - Number(item.quantity);
    });

    newItems.forEach(item => {
      const pid = item.product.toString();
      qtyDiff[pid] = (qtyDiff[pid] || 0) + Number(item.quantity);
    });

    for (const [pid, diff] of Object.entries(qtyDiff)) {
      if (diff !== 0) {
         diffItems.push({ product: pid, quantity: diff });
      }
    }
  }

  // Update fields while preventing storeId overwrite
  Object.assign(purchase, updateData);
  purchase.store = storeId;

  // Recalculate payment status if grandTotal/paidAmount provided
  if (updateData.grandTotal !== undefined && updateData.paidAmount !== undefined) {
      if (purchase.paidAmount >= purchase.grandTotal) {
          purchase.paymentStatus = 'paid';
          purchase.dueAmount = 0;
      } else if (purchase.paidAmount > 0) {
          purchase.paymentStatus = 'partial';
          purchase.dueAmount = purchase.grandTotal - purchase.paidAmount;
      } else {
          purchase.paymentStatus = 'pending';
          purchase.dueAmount = purchase.grandTotal;
      }
  }

  await purchase.save();

  // Apply stock differences
  if (diffItems.length > 0) {
    const stockErrors = await incrementInventory(diffItems, storeId);
    if (stockErrors.length > 0) {
      console.error("[PURCHASE SERVICE] Partial stock update errors on edit:", stockErrors);
    }
  }

  // Generate update notification
  await createNotificationService({
    storeId,
    type: 'PURCHASE_UPDATED',
    title: 'Purchase Updated',
    message: `Purchase ${purchase.invoiceNumber} was updated successfully.`,
    relatedEntityType: 'Purchase',
    relatedEntityId: purchase._id,
    priority: 'LOW'
  });

  if (purchase.dueAmount > 0) {
    await createNotificationService({
      storeId,
      type: 'PURCHASE_DUE',
      title: 'Payment Due',
      message: `₹${purchase.dueAmount} due for Purchase ${purchase.invoiceNumber}.`,
      relatedEntityType: 'Purchase',
      relatedEntityId: purchase._id,
      priority: 'MEDIUM'
    });
  }

  return purchase;
};

export const deletePurchase = async (purchaseId, storeId) => {
  const purchase = await Purchase.findOne({ _id: purchaseId, store: storeId });
  
  if (!purchase) {
    throw new ApiError("Purchase not found", 404);
  }

  // Revert product stock on deletion
  await decrementInventory(purchase.items, storeId);

  await purchase.deleteOne();
  return { message: "Purchase deleted successfully" };
};

/**
 * Create a purchase return atomically using a MongoDB session/transaction.
 *
 * Transaction steps (atomic):
 * 1. Validate purchase ownership (store security)
 * 2. Validate each product belongs to this store
 * 3. Validate returnable quantities
 * 4. Validate current stock is sufficient
 * 5. Create PurchaseReturn record
 * 6. Update purchase.items[].returnedQuantity and purchase.returnStatus
 * 7. Decrement Product.quantity for each returned item
 *
 * If any step fails, all operations are rolled back.
 */
export const createPurchaseReturn = async (purchaseId, storeId, returnData) => {
  const { items, reason, notes } = returnData;

  if (!items || items.length === 0) {
    throw new ApiError("Return must have at least one item", 400);
  }

  // Start MongoDB session for atomic transaction
  const session = await mongoose.startSession();

  try {
    let purchaseReturn;

    await session.withTransaction(async () => {
      // Step 1: Fetch & verify purchase belongs to this store (store security)
      const purchase = await Purchase.findOne({ _id: purchaseId, store: storeId }).session(session);
      if (!purchase) {
        throw new ApiError("Purchase not found", 404);
      }

      let totalReturnAmount = 0;
      const processedReturnItems = [];

      // Step 2-4: Validate each return item
      for (const returnItem of items) {
        // Verify product is in this purchase
        const purchaseItem = purchase.items.find(
          pi => pi.product.toString() === returnItem.product.toString()
        );
        if (!purchaseItem) {
          throw new ApiError(`Product ${returnItem.product} is not in this purchase`, 400);
        }

        const returnQty = Number(returnItem.quantity);
        if (!returnQty || returnQty <= 0 || !isFinite(returnQty)) {
          throw new ApiError("Return quantity must be greater than 0", 400);
        }

        // Check returnable quantity
        const alreadyReturned = purchaseItem.returnedQuantity || 0;
        const returnable = purchaseItem.quantity - alreadyReturned;

        if (returnQty > returnable) {
          throw new ApiError(
            `Cannot return ${returnQty} units. Only ${returnable} unit(s) are returnable for this product.`,
            400
          );
        }

        // Step 3: Verify product belongs to this store and check current stock
        const product = await Product.findOne({
          _id: returnItem.product,
          store: storeId
        }).session(session);

        if (!product) {
          throw new ApiError(`Product not found or does not belong to this store`, 404);
        }

        // Negative stock protection
        if (product.quantity < returnQty) {
          throw new ApiError(
            `Cannot return ${returnQty} units of "${product.name}" because only ${product.quantity} unit(s) are currently available in stock.`,
            400
          );
        }

        const itemReturnAmount = returnQty * purchaseItem.purchasePrice;
        totalReturnAmount += itemReturnAmount;

        processedReturnItems.push({
          product: returnItem.product,
          productName: product.name, // snapshot
          quantity: returnQty,
          purchasePrice: purchaseItem.purchasePrice,
          returnAmount: itemReturnAmount
        });

        // Update returnedQuantity on the purchase item (in-memory, saved below)
        purchaseItem.returnedQuantity = alreadyReturned + returnQty;
      }

      // Step 5: Determine new return status
      let allFullyReturned = true;
      let anyReturned = false;

      for (const pi of purchase.items) {
        if ((pi.returnedQuantity || 0) > 0) anyReturned = true;
        if ((pi.returnedQuantity || 0) < pi.quantity) allFullyReturned = false;
      }

      if (allFullyReturned) {
        purchase.returnStatus = 'full';
      } else if (anyReturned) {
        purchase.returnStatus = 'partial';
      }

      // Step 6: Create PurchaseReturn record (inside transaction)
      const [newReturn] = await PurchaseReturn.create(
        [{
          store: storeId,
          purchase: purchaseId,
          seller: purchase.seller,
          items: processedReturnItems,
          totalReturnAmount,
          reason,
          notes: notes || undefined
        }],
        { session }
      );
      purchaseReturn = newReturn;

      // Step 7: Save updated purchase (returnedQuantity + returnStatus)
      await purchase.save({ session });

      // Step 8: Atomically decrement stock for each returned product
      for (const ri of processedReturnItems) {
        const updated = await Product.findByIdAndUpdate(
          ri.product,
          { $inc: { quantity: -ri.quantity } },
          { session, new: true }
        );

        // Sync Inventory record best-effort (outside strict transaction scope to avoid locking issues)
        try {
          const inv = await Inventory.findOne({ store: storeId, product: ri.product });
          if (inv) {
            inv.quantity = Math.max(0, updated?.quantity ?? (inv.quantity - ri.quantity));
            await inv.save();
            await checkInventoryAlertsService(storeId, ri.product, inv.quantity, inv.minStockLevel || 10);
          } else {
            await checkInventoryAlertsService(storeId, ri.product, updated.quantity, 10);
          }
        } catch (invErr) {
          console.warn("[PURCHASE RETURN] Could not sync Inventory record:", invErr.message);
        }
      }
    });

    // Generate return notification outside of the transaction
    if (purchaseReturn) {
      await createNotificationService({
        storeId,
        type: 'PURCHASE_RETURNED',
        title: 'Purchase Returned',
        message: `Return completed for Purchase Invoice. Amount: ₹${purchaseReturn.totalReturnAmount}`,
        relatedEntityType: 'PurchaseReturn',
        relatedEntityId: purchaseReturn._id,
        priority: 'LOW'
      });
    }

    return purchaseReturn;
  } finally {
    await session.endSession();
  }
};

export const getPurchaseReturns = async (purchaseId, storeId) => {
  // Verify purchase belongs to this store before returning return history
  const purchaseExists = await Purchase.countDocuments({ _id: purchaseId, store: storeId });
  if (!purchaseExists) {
    throw new ApiError("Purchase not found", 404);
  }

  const returns = await PurchaseReturn.find({ purchase: purchaseId, store: storeId })
    .populate('items.product', 'name sku')
    .sort({ returnDate: -1 });
  return returns;
};

/**
 * Helper to parse and calculate date boundaries for purchase analytics.
 * Supports: today, yesterday, 7d, 30d, thisMonth, lastMonth, thisYear, custom
 */
export const parsePurchaseAnalyticsDates = (query = {}) => {
  const now = new Date();
  let startDate, endDate;
  const rawRange = (query.range || (query.startDate ? 'custom' : '30d')).toLowerCase();

  switch (rawRange) {
    case 'today': {
      startDate = new Date(now);
      startDate.setHours(0, 0, 0, 0);
      endDate = new Date(now);
      endDate.setHours(23, 59, 59, 999);
      break;
    }
    case 'yesterday': {
      startDate = new Date(now);
      startDate.setDate(startDate.getDate() - 1);
      startDate.setHours(0, 0, 0, 0);
      endDate = new Date(now);
      endDate.setDate(endDate.getDate() - 1);
      endDate.setHours(23, 59, 59, 999);
      break;
    }
    case '7d':
    case 'last7days': {
      startDate = new Date(now);
      startDate.setDate(startDate.getDate() - 6);
      startDate.setHours(0, 0, 0, 0);
      endDate = new Date(now);
      endDate.setHours(23, 59, 59, 999);
      break;
    }
    case '30d':
    case 'last30days': {
      startDate = new Date(now);
      startDate.setDate(startDate.getDate() - 29);
      startDate.setHours(0, 0, 0, 0);
      endDate = new Date(now);
      endDate.setHours(23, 59, 59, 999);
      break;
    }
    case 'thismonth': {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      endDate = new Date(now);
      endDate.setHours(23, 59, 59, 999);
      break;
    }
    case 'lastmonth': {
      startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0);
      endDate = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
      break;
    }
    case 'thisyear': {
      startDate = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
      endDate = new Date(now);
      endDate.setHours(23, 59, 59, 999);
      break;
    }
    case 'custom':
    default: {
      if (query.startDate && query.endDate) {
        startDate = new Date(query.startDate);
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(query.endDate);
        endDate.setHours(23, 59, 59, 999);

        if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
          throw new ApiError("Invalid custom startDate or endDate. Use YYYY-MM-DD format.", 400);
        }
        if (startDate > endDate) {
          throw new ApiError("Start date cannot be after end date.", 400);
        }
      } else {
        // default 30 days
        startDate = new Date(now);
        startDate.setDate(startDate.getDate() - 29);
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(now);
        endDate.setHours(23, 59, 59, 999);
      }
      break;
    }
  }

  const diffDays = Math.max(1, Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)));
  return { startDate, endDate, range: rawRange, diffDays };
};

/**
 * Get comprehensive purchase analytics for an authorized store.
 * Aggregates summary, trend, top suppliers, top products, payments, returns, and recent purchases.
 */
export const getPurchaseAnalytics = async (storeId, query = {}) => {
  if (!mongoose.Types.ObjectId.isValid(storeId)) {
    throw new ApiError("Invalid store ID", 400);
  }

  const storeObjectId = new mongoose.Types.ObjectId(storeId);
  const { startDate, endDate, range, diffDays } = parsePurchaseAnalyticsDates(query);

  const purchaseMatch = {
    store: storeObjectId,
    purchaseDate: { $gte: startDate, $lte: endDate }
  };

  const returnMatch = {
    store: storeObjectId,
    returnDate: { $gte: startDate, $lte: endDate }
  };

  const isMonthly = diffDays > 31;
  const dateFormat = isMonthly ? "%Y-%m" : "%Y-%m-%d";

  const [
    summaryAgg,
    returnSummaryAgg,
    largestPurchaseDoc,
    trendAgg,
    supplierAgg,
    supplierReturnsAgg,
    productAgg,
    paymentStatusAgg,
    returnStatusAgg,
    returnReasonAgg,
    recentPurchasesDocs
  ] = await Promise.all([
    // 1. Summary totals
    Purchase.aggregate([
      { $match: purchaseMatch },
      {
        $group: {
          _id: null,
          totalPurchase: { $sum: "$grandTotal" },
          purchaseOrders: { $sum: 1 },
          amountPaid: { $sum: "$paidAmount" },
          amountDue: { $sum: "$dueAmount" }
        }
      }
    ]),

    // 2. Return totals
    PurchaseReturn.aggregate([
      { $match: returnMatch },
      {
        $group: {
          _id: null,
          returnedAmount: { $sum: "$totalReturnAmount" },
          returnCount: { $sum: 1 },
          totalReturnedQuantity: {
            $sum: {
              $reduce: {
                input: "$items",
                initialValue: 0,
                in: { $add: ["$$value", "$$this.quantity"] }
              }
            }
          }
        }
      }
    ]),

    // 3. Largest single purchase
    Purchase.findOne(purchaseMatch)
      .sort({ grandTotal: -1 })
      .populate('seller', 'name phone')
      .select('invoiceNumber grandTotal paidAmount dueAmount purchaseDate seller items')
      .lean(),

    // 4. Trend over time (daily or monthly)
    Purchase.aggregate([
      { $match: purchaseMatch },
      {
        $group: {
          _id: { $dateToString: { format: dateFormat, date: "$purchaseDate" } },
          amount: { $sum: "$grandTotal" },
          orders: { $sum: 1 },
          paid: { $sum: "$paidAmount" }
        }
      },
      { $sort: { _id: 1 } }
    ]),

    // 5. Supplier aggregation
    Purchase.aggregate([
      { $match: purchaseMatch },
      {
        $group: {
          _id: "$seller",
          purchaseCount: { $sum: 1 },
          totalPurchaseAmount: { $sum: "$grandTotal" },
          amountPaid: { $sum: "$paidAmount" },
          amountDue: { $sum: "$dueAmount" }
        }
      },
      { $sort: { totalPurchaseAmount: -1 } },
      { $limit: 15 },
      {
        $lookup: {
          from: "sellers",
          localField: "_id",
          foreignField: "_id",
          as: "sellerDetails"
        }
      },
      {
        $unwind: {
          path: "$sellerDetails",
          preserveNullAndEmptyArrays: true
        }
      },
      {
        $project: {
          _id: 1,
          sellerId: "$_id",
          sellerName: { $ifNull: ["$sellerDetails.name", "Unknown Supplier"] },
          phone: "$sellerDetails.phone",
          businessName: "$sellerDetails.businessName",
          purchaseCount: 1,
          totalPurchaseAmount: 1,
          amountPaid: 1,
          amountDue: 1
        }
      }
    ]),

    // 6. Return totals grouped by seller
    PurchaseReturn.aggregate([
      { $match: returnMatch },
      {
        $group: {
          _id: "$seller",
          returnedAmount: { $sum: "$totalReturnAmount" },
          returnCount: { $sum: 1 }
        }
      }
    ]),

    // 7. Product purchase analysis
    Purchase.aggregate([
      { $match: purchaseMatch },
      { $unwind: "$items" },
      {
        $group: {
          _id: "$items.product",
          purchasedQuantity: { $sum: "$items.quantity" },
          purchaseValue: {
            $sum: {
              $ifNull: [
                "$items.subtotal",
                { $multiply: ["$items.quantity", "$items.purchasePrice"] }
              ]
            }
          },
          returnedQuantity: {
            $sum: { $ifNull: ["$items.returnedQuantity", 0] }
          }
        }
      },
      { $sort: { purchasedQuantity: -1 } },
      { $limit: 25 },
      {
        $lookup: {
          from: "products",
          localField: "_id",
          foreignField: "_id",
          as: "productDetails"
        }
      },
      {
        $unwind: {
          path: "$productDetails",
          preserveNullAndEmptyArrays: true
        }
      },
      {
        $project: {
          _id: 1,
          productId: "$_id",
          name: { $ifNull: ["$productDetails.name", "Unknown Product"] },
          sku: { $ifNull: ["$productDetails.sku", ""] },
          category: { $ifNull: ["$productDetails.category", "General"] },
          purchasedQuantity: 1,
          purchaseValue: 1,
          returnedQuantity: 1,
          netQuantity: { $subtract: ["$purchasedQuantity", "$returnedQuantity"] }
        }
      }
    ]),

    // 8. Payment status breakdown
    Purchase.aggregate([
      { $match: purchaseMatch },
      {
        $group: {
          _id: "$paymentStatus",
          count: { $sum: 1 },
          totalAmount: { $sum: "$grandTotal" },
          paidAmount: { $sum: "$paidAmount" },
          dueAmount: { $sum: "$dueAmount" }
        }
      }
    ]),

    // 9. Return status breakdown
    Purchase.aggregate([
      { $match: purchaseMatch },
      {
        $group: {
          _id: "$returnStatus",
          count: { $sum: 1 }
        }
      }
    ]),

    // 10. Return reasons breakdown
    PurchaseReturn.aggregate([
      { $match: returnMatch },
      {
        $group: {
          _id: "$reason",
          count: { $sum: 1 },
          amount: { $sum: "$totalReturnAmount" }
        }
      },
      { $sort: { amount: -1 } }
    ]),

    // 11. Recent purchases
    Purchase.find(purchaseMatch)
      .sort({ purchaseDate: -1 })
      .limit(10)
      .populate('seller', 'name')
      .select('invoiceNumber seller purchaseDate items grandTotal paidAmount dueAmount paymentStatus returnStatus')
      .lean()
  ]);

  // Combine supplier data with returns
  const sellerReturnsMap = new Map();
  for (const ret of supplierReturnsAgg) {
    if (ret._id) {
      sellerReturnsMap.set(ret._id.toString(), ret.returnedAmount || 0);
    }
  }

  const supplierAnalysis = supplierAgg.map(s => ({
    ...s,
    returnedAmount: sellerReturnsMap.get(s.sellerId ? s.sellerId.toString() : '') || 0
  }));

  // Calculations for summary cards
  const totalPurchase = summaryAgg[0]?.totalPurchase || 0;
  const purchaseOrders = summaryAgg[0]?.purchaseOrders || 0;
  const amountPaid = summaryAgg[0]?.amountPaid || 0;
  const amountDue = summaryAgg[0]?.amountDue || 0;
  const returnedAmount = returnSummaryAgg[0]?.returnedAmount || 0;
  const totalReturnedQuantity = returnSummaryAgg[0]?.totalReturnedQuantity || 0;
  const returnCount = returnSummaryAgg[0]?.returnCount || 0;
  const netPurchase = Math.max(0, totalPurchase - returnedAmount);
  const averagePurchase = purchaseOrders > 0 ? Math.round((totalPurchase / purchaseOrders) * 100) / 100 : 0;
  const returnRate = totalPurchase > 0 ? Math.round((returnedAmount / totalPurchase) * 10000) / 100 : 0;

  // Largest purchase card data
  const largestPurchase = largestPurchaseDoc ? {
    _id: largestPurchaseDoc._id,
    invoiceNumber: largestPurchaseDoc.invoiceNumber,
    grandTotal: largestPurchaseDoc.grandTotal,
    paidAmount: largestPurchaseDoc.paidAmount,
    dueAmount: largestPurchaseDoc.dueAmount,
    purchaseDate: largestPurchaseDoc.purchaseDate,
    sellerName: largestPurchaseDoc.seller?.name || "Unknown Supplier",
    sellerPhone: largestPurchaseDoc.seller?.phone || "",
    itemsCount: largestPurchaseDoc.items?.length || 0
  } : null;

  // Continuous trend timeline construction
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const trendMap = new Map();

  if (isMonthly) {
    const curr = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
    const last = new Date(endDate.getFullYear(), endDate.getMonth(), 1);
    while (curr <= last) {
      const y = curr.getFullYear();
      const m = String(curr.getMonth() + 1).padStart(2, '0');
      const key = `${y}-${m}`;
      const label = `${monthNames[curr.getMonth()]} ${y}`;
      trendMap.set(key, { key, date: key, label, amount: 0, orders: 0, paid: 0 });
      curr.setMonth(curr.getMonth() + 1);
    }
  } else {
    const curr = new Date(startDate);
    while (curr <= endDate) {
      const y = curr.getFullYear();
      const m = String(curr.getMonth() + 1).padStart(2, '0');
      const d = String(curr.getDate()).padStart(2, '0');
      const key = `${y}-${m}-${d}`;
      const label = `${d} ${monthNames[curr.getMonth()]}`;
      trendMap.set(key, { key, date: key, label, amount: 0, orders: 0, paid: 0 });
      curr.setDate(curr.getDate() + 1);
    }
  }

  for (const t of trendAgg) {
    if (trendMap.has(t._id)) {
      const item = trendMap.get(t._id);
      item.amount = Math.round(t.amount * 100) / 100;
      item.orders = t.orders;
      item.paid = Math.round(t.paid * 100) / 100;
    }
  }

  const purchaseTrend = Array.from(trendMap.values());

  // Payment status breakdown
  const statusCounts = { paid: 0, partial: 0, unpaid: 0 };
  const statusAmounts = { paid: 0, partial: 0, unpaid: 0 };
  for (const stat of paymentStatusAgg) {
    if (stat._id && statusCounts.hasOwnProperty(stat._id)) {
      statusCounts[stat._id] = stat.count || 0;
      statusAmounts[stat._id] = stat.totalAmount || 0;
    }
  }

  const paymentAnalysis = {
    totalPurchase,
    amountPaid,
    amountDue,
    statusCounts,
    statusAmounts
  };

  // Return status breakdown
  const returnStatusCounts = { none: 0, partial: 0, full: 0 };
  for (const rs of returnStatusAgg) {
    if (rs._id && returnStatusCounts.hasOwnProperty(rs._id)) {
      returnStatusCounts[rs._id] = rs.count || 0;
    }
  }

  // Return analytics
  const returnAnalysis = {
    totalReturnedQuantity,
    totalReturnedAmount: returnedAmount,
    returnCount,
    returnRate,
    reasonBreakdown: returnReasonAgg.map(r => ({
      reason: r._id || "Other",
      count: r.count,
      amount: r.amount
    }))
  };

  // Recent purchases formatted
  const formattedRecentPurchases = recentPurchasesDocs.map(p => ({
    _id: p._id,
    invoiceNumber: p.invoiceNumber,
    sellerName: p.seller?.name || "N/A",
    purchaseDate: p.purchaseDate,
    itemsCount: p.items?.length || 0,
    grandTotal: p.grandTotal,
    paidAmount: p.paidAmount,
    dueAmount: p.dueAmount,
    paymentStatus: p.paymentStatus,
    returnStatus: p.returnStatus || 'none'
  }));

  // Top products by purchase value
  const topProductsByValue = [...productAgg]
    .sort((a, b) => b.purchaseValue - a.purchaseValue)
    .slice(0, 10);

  return {
    dateRange: {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      range,
      diffDays,
      isMonthly
    },
    summary: {
      totalPurchase,
      purchaseOrders,
      amountPaid,
      amountDue,
      returnedAmount,
      netPurchase,
      averagePurchase,
      largestPurchase
    },
    purchaseTrend,
    supplierAnalysis,
    productAnalysis: productAgg,
    topProductsByValue,
    paymentAnalysis,
    returnAnalysis,
    purchaseStatusCounts: returnStatusCounts,
    recentPurchases: formattedRecentPurchases
  };
};

