import { ApiResponse } from "../../utils/ApiResponse.js";
import { materializeSaleFromCart } from "./sale.service.js";
import { Sale } from "../../models/index.js";

export const createSaleFromCartController = async (req, res) => {
  try {
    const result = await materializeSaleFromCart(req.params.cartId, req.user._id);

    res.status(result.saleCreated ? 201 : 200).json(
      new ApiResponse(
        {
          sale: result.sale,
          cart: result.cart,
          inventoryAdjusted: result.inventoryAdjusted,
          saleCreated: result.saleCreated,
        },
        result.saleCreated
          ? "Sale snapshot created successfully"
          : "Sale snapshot already exists",
        result.saleCreated ? 201 : 200
      )
    );
  } catch (error) {
    res
      .status(error.statusCode || 500)
      .json(new ApiResponse(null, error.message, error.statusCode || 500));
  }
};

/**
 * GET /api/sales/store/:storeId
 * List all sales for a store with filters: paymentStatus, buyer, startDate, endDate, page, limit
 */
export const getSalesByStoreController = async (req, res) => {
  try {
    const { storeId } = req.params;
    const { paymentStatus, buyer, startDate, endDate, page = 1, limit = 20, search } = req.query;

    const query = { store: storeId };

    if (paymentStatus && paymentStatus !== 'all') query.paymentStatus = paymentStatus;
    if (buyer && buyer !== 'all') query.buyer = buyer;

    if (startDate || endDate) {
      query.completedAt = {};
      if (startDate) query.completedAt.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        query.completedAt.$lte = end;
      }
    }

    // Search by item name snapshot
    if (search) {
      query['items.nameSnapshot'] = new RegExp(search, 'i');
    }

    const skip = (Number(page) - 1) * Number(limit);

    const [sales, total] = await Promise.all([
      Sale.find(query)
        .populate('buyer', 'name phone')
        .sort({ completedAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .lean(),
      Sale.countDocuments(query),
    ]);

    return res.status(200).json(
      new ApiResponse(
        { sales, total, page: Number(page), totalPages: Math.ceil(total / Number(limit)) },
        'Sales fetched successfully',
        200
      )
    );
  } catch (error) {
    console.error('[SALE] getSalesByStore error:', error);
    return res.status(500).json(new ApiResponse(null, error.message || 'Internal Server Error', 500));
  }
};
