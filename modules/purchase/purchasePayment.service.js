import mongoose from 'mongoose';
import { Purchase, Payment, Seller, Store } from '../../models/index.js';
import { ApiError } from '../../utils/ApiError.js';
import { notifyPaymentReceived } from '../../events/notificationEvents.js';

export const recordPurchasePayment = async (storeId, purchaseId, userId, data) => {
  const { amount, paymentMethod, paymentDate, referenceNumber, notes } = data;
  
  if (!amount || amount <= 0) {
    throw new ApiError("Payment amount must be greater than zero", 400);
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const purchase = await Purchase.findOne({
      _id: purchaseId,
      store: storeId
    }).session(session);

    if (!purchase) {
      throw new ApiError("Purchase not found", 404);
    }

    if (amount > purchase.dueAmount) {
      throw new ApiError(`Payment cannot exceed the remaining due amount (₹${purchase.dueAmount})`, 400);
    }

    // 1. Create Payment Record
    const payment = await Payment.create([{
      store: storeId,
      seller: purchase.seller,
      transaction: purchaseId,
      transactionModel: 'Purchase',
      transactionType: 'payment_out',
      amount,
      paymentMethod,
      paymentDate: paymentDate || new Date(),
      referenceNumber,
      notes
    }], { session });

    // 2. Update Purchase Record
    purchase.paidAmount += amount;
    // Note: purchase schema pre('save') handles dueAmount and paymentStatus calculation automatically
    await purchase.save({ session });

    // 3. Update Seller totals
    await Seller.findByIdAndUpdate(
      purchase.seller,
      {
        $inc: {
          totalPaid: amount,
          totalDue: -amount
        }
      },
      { session }
    );

    await session.commitTransaction();
    session.endSession();

    // Fire & forget event-driven notification (outside transaction)
    notifyPaymentReceived({
      storeId,
      amount,
      invoiceNumber: purchase.invoiceNumber,
      user: userId,
    });
    return { payment: payment[0], purchase };
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    throw error;
  }
};

export const getPurchasePayments = async (storeId, purchaseId) => {
  const payments = await Payment.find({
    store: storeId,
    transaction: purchaseId,
    transactionModel: 'Purchase'
  }).sort({ paymentDate: -1, createdAt: -1 });

  return payments;
};

export const getSellerPayments = async (storeId, sellerId, query) => {
  const { page = 1, limit = 10, search, startDate, endDate, paymentMethod } = query;

  const filter = {
    store: new mongoose.Types.ObjectId(storeId),
    seller: new mongoose.Types.ObjectId(sellerId),
    transactionModel: 'Purchase'
  };

  if (startDate || endDate) {
    filter.paymentDate = {};
    if (startDate) filter.paymentDate.$gte = new Date(startDate);
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      filter.paymentDate.$lte = end;
    }
  }

  if (paymentMethod) {
    filter.paymentMethod = paymentMethod;
  }

  if (search) {
    filter.referenceNumber = new RegExp(search, 'i');
  }

  const skip = (Number(page) - 1) * Number(limit);

  const [payments, total] = await Promise.all([
    Payment.find(filter)
      .populate({
        path: 'transaction',
        select: 'invoiceNumber grandTotal paidAmount dueAmount'
      })
      .sort({ paymentDate: -1, createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .lean(),
    Payment.countDocuments(filter)
  ]);

  return {
    payments,
    pagination: {
      total,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(total / Number(limit))
    }
  };
};
