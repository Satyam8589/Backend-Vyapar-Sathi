import { Product, Sale, Store, Inventory } from "../../models/index.js";
import { ApiError } from "../../utils/ApiError.js";
import { assertCartAccess } from "../store/storeAccess.service.js";
import { sendLowStockNotificationEmail } from "../../utils/mailer.js";

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
    const productId = item.product?._id || item.product;
    const qtyToSubtract = Number(item.quantity || 0);

    let updatedProd = null;
    if (Product && typeof Product.findByIdAndUpdate === "function") {
      updatedProd = await Product.findByIdAndUpdate(
        productId,
        { $inc: { quantity: -qtyToSubtract } },
        { new: true }
      );
    }

    // Sync Inventory model if present
    if (Inventory && typeof Inventory.findOne === "function") {
      try {
        const inv = await Inventory.findOne({ store: cart.store, product: productId });
        if (inv) {
          inv.quantity = Math.max(0, updatedProd?.quantity ?? (inv.quantity - qtyToSubtract));
          await inv.save();
        }
      } catch (invErr) {
        console.warn("[SALE SERVICE] Could not update Inventory record:", invErr.message);
      }
    }
  }
};

const checkAndSendLowStockAlerts = async (cart) => {
  try {
    if (!cart?.store || !cart?.products?.length) return;
    if (!Store || typeof Store.findById !== "function") return;

    const storeQuery = Store.findById(cart.store);
    const store = storeQuery && typeof storeQuery.populate === "function"
      ? await storeQuery.populate("owner")
      : await storeQuery;

    if (!store) return;

    const threshold = Number(store.settings?.lowStockThreshold ?? 10);
    const recipientEmail = store.email || store.owner?.email;

    if (!recipientEmail) {
      console.warn(`[LOW STOCK MAIL] Store ${store._id} (${store.name}) has no email address configured.`);
      return;
    }

    const productIds = cart.products
      .map((item) => item.product?._id || item.product)
      .filter(Boolean);

    if (!productIds.length || !Product || typeof Product.find !== "function") return;

    const updatedProducts = await Product.find({ _id: { $in: productIds } });

    const lowStockProducts = updatedProducts
      .filter((p) => typeof p.quantity === "number" && p.quantity <= threshold)
      .map((p) => ({
        name: p.name,
        brand: p.brand || "-",
        barcode: p.barcode || "-",
        category: p.category || "General",
        currentStock: p.quantity,
        unit: p.unit || "pcs",
        price: p.price,
      }));

    if (lowStockProducts.length > 0) {
      console.log(
        `[LOW STOCK MAIL] Triggering mail alert for store "${store.name}" to ${recipientEmail} (${lowStockProducts.length} low stock item(s))`
      );
      await sendLowStockNotificationEmail(recipientEmail, {
        storeName: store.name,
        storeId: store._id.toString(),
        lowStockThreshold: threshold,
        lowStockProducts,
      });
    }
  } catch (err) {
    console.error("[LOW STOCK MAIL TRIGGER ERROR]", err?.message || err);
  }
};

export const materializeSaleFromCart = async (cartId, userId) => {
  if (!userId) {
    throw new ApiError("User not registered. Please complete registration first.", 403);
  }

  const cart = await assertCartAccess(cartId, userId, "products.product");

  const existingSale = await Sale.findOne({ cart: cartId });
  if (existingSale) {
    console.log(
      `[SALE SERVICE] Reusing existing sale snapshot for cart=${cartId} sale=${existingSale._id}`
    );

    if (cart.status !== "completed") {
      cart.status = "completed";
      await cart.save();
      console.log(
        `[SALE SERVICE] Cart ${cartId} marked completed while reusing existing sale snapshot`
      );
    }

    return {
      sale: existingSale,
      cart,
      inventoryAdjusted: false,
      saleCreated: false,
    };
  }

  if (!cart.products.length) {
    throw new ApiError("Cannot complete sale for an empty cart", 400);
  }

  const isBackfillForCompletedCart = cart.status === "completed";

  if (cart.paymentStatus !== "paid") {
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

    // Fire low-stock check asynchronously in background via setImmediate (100% decoupled from billing)
    setImmediate(() => {
      checkAndSendLowStockAlerts(cart).catch((err) =>
        console.error("[LOW STOCK TRIGGER EXCEPTION]", err)
      );
    });
  }

  const sale = await Sale.create({
    store: cart.store,
    user: cart.user,
    cart: cart._id,
    items,
    totalAmount: cart.totalPrice || items.reduce((sum, item) => sum + item.lineTotal, 0),
    subtotal: cart.subtotal || totalAmount,
    discount: cart.discount || { type: "fixed", value: 0, amount: 0 },
    paymentId: cart.paymentId || null,
    completedAt: isBackfillForCompletedCart ? cart.updatedAt || new Date() : new Date(),
  });

  console.log(
    `[SALE SERVICE] Created sale snapshot for cart=${cartId} sale=${sale._id} mode=${isBackfillForCompletedCart ? "backfill" : "live"}`
  );

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
