import { Cart } from "../../models/index.js";
import { Product } from "../../models/index.js";
import { ApiError } from "../../utils/ApiError.js";
import { assertCartAccess } from "../store/storeAccess.service.js";
import { materializeSaleFromCart } from "../sale/sale.service.js";

export const createCart = async (cartData) => {
  try {
    if (!cartData.user || !cartData.store) {
      throw new ApiError(400, "User and Store references are required");
    }

    let cart = await Cart.findOne({
      user: cartData.user,
      store: cartData.store,
      status: { $in: ["open", "scanning"] },
    });

    if (cart) {
      return cart;
    }

    cart = await Cart.create(cartData);
    if (!cart) {
      throw new ApiError(400, "Failed to create cart");
    }
    return cart;
  } catch (error) {
    throw error;
  }
};

export const startScanning = async (cartId) => {
  const cart = await Cart.findByIdAndUpdate(
    cartId,
    { status: "scanning" },
    { new: true },
  );
  if (!cart) throw new ApiError(404, "Cart not found");
  return cart;
};

export const addItemToCart = async (cartId, productId, quantity = 1) => {
  const cart = await Cart.findById(cartId);
  if (!cart) throw new ApiError(404, "Cart not found");
  if (cart.status !== "scanning" && cart.status !== "open") {
    throw new ApiError(400, "Cannot add items to cart in current status");
  }

  const product = await Product.findById(productId);
  if (!product) throw new ApiError(404, "Product not found");
  if (product.quantity < quantity)
    throw new ApiError(400, "Insufficient stock");

  const itemIndex = cart.products.findIndex(
    (p) => p.product.toString() === productId,
  );

  if (itemIndex > -1) {
    cart.products[itemIndex].quantity += quantity;
  } else {
    cart.products.push({
      product: productId,
      quantity,
      price: product.price,
    });
  }

  // Recalculate total price
  cart.totalPrice = cart.products.reduce(
    (acc, curr) => acc + curr.price * curr.quantity,
    0,
  );

  await cart.save();
  return cart;
};

export const processPayment = async (cartId, paymentId, subtotal, discount, totalPrice) => {
  const cart = await Cart.findById(cartId);
  if (!cart) throw new ApiError(404, "Cart not found");

  cart.paymentId = paymentId;
  cart.paymentStatus = "paid";
  cart.status = "payment_pending"; // Waiting for owner confirmation

  if (subtotal !== undefined) cart.subtotal = subtotal;
  if (discount !== undefined) cart.discount = discount;
  if (totalPrice !== undefined) cart.totalPrice = totalPrice;

  await cart.save();
  return cart;
};

export const confirmPayment = async (cartId, userId) => {
  if (!userId) {
    throw new ApiError("User not registered. Please complete registration first.", 403);
  }

  const cart = await assertCartAccess(cartId, userId);

  if (cart.paymentStatus !== "paid") {
    throw new ApiError("Payment hasn't been made yet", 400);
  }

  console.log(`[CART SERVICE] Confirming payment for cart=${cartId}`);
  const result = await materializeSaleFromCart(cartId, userId);
  console.log(
    `[CART SERVICE] Payment confirmation completed for cart=${cartId} saleCreated=${result.saleCreated}`
  );

  return result.cart;
};

export const getProductByBarcodeInCart = async (cartId, barcode) => {
  const cart = await Cart.findById(cartId);
  if (!cart) throw new ApiError(404, "Cart not found");

  const product = await Product.findOne({
    store: cart.store,
    barcode: barcode,
    isActive: true,
  });

  if (!product) {
    throw new ApiError(
      404,
      "Product not found in this store with this barcode",
    );
  }

  return product;
};

export const getBillHistory = async (storeId, limit = 50, page = 1, filters = {}) => {
  try {
    if (!storeId) {
      throw new ApiError(400, "Store ID is required");
    }

    const { date, month, year } = filters;
    const query = {
      store: storeId,
      status: "completed",
      paymentStatus: "paid",
    };

    // Apply date filters
    if (date) {
      const start = new Date(date);
      start.setHours(0, 0, 0, 0);
      const end = new Date(date);
      end.setHours(23, 59, 59, 999);
      query.updatedAt = { $gte: start, $lte: end };
    } else if (month && year) {
      const start = new Date(year, month - 1, 1);
      const end = new Date(year, month, 0, 23, 59, 59, 999);
      query.updatedAt = { $gte: start, $lte: end };
    } else if (year) {
      const start = new Date(year, 0, 1);
      const end = new Date(year, 11, 31, 23, 59, 59, 999);
      query.updatedAt = { $gte: start, $lte: end };
    }

    const skip = (page - 1) * limit;

    const bills = await Cart.find(query)
      .populate("user", "name email")
      .populate("products.product", "name barcode")
      .sort({ updatedAt: -1 })
      .limit(limit)
      .skip(skip);

    const total = await Cart.countDocuments(query);

    return {
      bills,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  } catch (error) {
    throw error;
  }
};
