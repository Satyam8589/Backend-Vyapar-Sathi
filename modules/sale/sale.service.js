import { Cart, Product, Sale } from "../../models/index.js";
import { ApiError } from "../../utils/ApiError.js";
import { assertCartAccess } from "../store/storeAccess.service.js";

const buildSaleItems = (cart) =>
  cart.products.map((item) => {
    const product = item.product;

    if (!product) {
      throw new ApiError("Cart contains an unavailable product", 400);
    }

    const quantity = Number(item.quantity || 0);
    const unitPrice = Number(item.price ?? product.price ?? 0);

    return {
      productId: product._id,
      nameSnapshot: product.name,
      categorySnapshot: product.category || "General",
      quantity,
      unitPrice,
      lineTotal: unitPrice * quantity,
    };
  });

const ensureInventoryAvailability = async (cart) => {
  for (const item of cart.products) {
    const currentProduct = item.product;

    if (!currentProduct?.isActive) {
      throw new ApiError(
        `Product "${currentProduct?.name || "Unknown"}" is inactive`,
        400
      );
    }

    if ((currentProduct.quantity || 0) < item.quantity) {
      throw new ApiError(
        `Insufficient stock for "${currentProduct.name}". Available: ${currentProduct.quantity}`,
        400
      );
    }
  }
};

const decrementInventory = async (cart) => {
  for (const item of cart.products) {
    await Product.findByIdAndUpdate(item.product._id, {
      $inc: { quantity: -item.quantity },
    });
  }
};

export const materializeSaleFromCart = async (cartId, userId) => {
  const existingSale = await Sale.findOne({ cart: cartId });
  if (existingSale) {
    const existingCart = await Cart.findById(cartId);
    return {
      sale: existingSale,
      cart: existingCart,
      inventoryAdjusted: false,
      saleCreated: false,
    };
  }

  const cart = await assertCartAccess(cartId, userId, "products.product");

  if (!cart.products.length) {
    throw new ApiError("Cannot complete sale for an empty cart", 400);
  }

  const isBackfillForCompletedCart = cart.status === "completed";

  if (!isBackfillForCompletedCart && cart.paymentStatus !== "paid") {
    throw new ApiError("Payment has not been completed yet", 400);
  }

  if (!isBackfillForCompletedCart) {
    await ensureInventoryAvailability(cart);
  }

  const items = buildSaleItems(cart);
  const totalAmount =
    cart.totalPrice || items.reduce((sum, item) => sum + item.lineTotal, 0);

  if (!isBackfillForCompletedCart) {
    await decrementInventory(cart);
  }

  const sale = await Sale.create({
    store: cart.store,
    user: cart.user,
    cart: cart._id,
    items,
    totalAmount,
    paymentId: cart.paymentId || null,
    completedAt: isBackfillForCompletedCart ? cart.updatedAt || new Date() : new Date(),
  });

  if (cart.status !== "completed") {
    cart.status = "completed";
    await cart.save();
  }

  return {
    sale,
    cart,
    inventoryAdjusted: !isBackfillForCompletedCart,
    saleCreated: true,
  };
};
