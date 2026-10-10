import { Product, Sale, Store, Inventory } from "../../models/index.js";
import { ApiError } from "../../utils/ApiError.js";
import { assertCartAccess } from "../store/storeAccess.service.js";
import { sendLowStockNotificationEmail } from "../../utils/mailer.js";
import { createBuyer } from "../buyer/buyer.service.js";
import { checkInventoryAlertsService } from "../notification/notification.service.js";
import { notifySaleCreated } from "../../events/notificationEvents.js";

const buildSaleItems = (cart) =>
  cart.products.map((item) => {
    const product = item.product;

    if (!product) {
      throw new ApiError("Cart contains an unavailable product", 400);
    }

    const quantity = Number(item.quantity || 0);
    const unitPrice = Number(item.price ?? product.sellingPrice ?? 0);
    const unitBuyingPrice = Number(product.buyingPrice ?? 0);

    return {
      productId: product._id,
      nameSnapshot: product.name,
      categorySnapshot: product.category || "General",
      quantity,
      unitPrice,
      unitBuyingPrice,
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
          await checkInventoryAlertsService(cart.store, productId, inv.quantity, inv.minStockLevel || 10);
        } else {
          await checkInventoryAlertsService(cart.store, productId, updatedProd.quantity, 10);
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

    if (!Product || typeof Product.find !== "function") return;

    const query = Product.find({
      store: store._id,
      isActive: { $ne: false },
      quantity: { $lte: threshold },
    });
    const lowStockDocs = typeof query?.sort === "function" ? await query.sort({ quantity: 1 }) : await query;

    const lowStockProducts = (Array.isArray(lowStockDocs) ? lowStockDocs : [])
      .filter((p) => typeof p.quantity === "number" && p.quantity <= threshold)
      .map((p) => ({
        name: p.name,
        category: p.category || "General",
        barcode: p.barcode || p.sku || "-",
        currentStock: p.quantity,
        unit: p.unit || "pcs",
        price: p.sellingPrice,
      }));

    if (lowStockProducts.length > 0) {
      console.log(
        `[LOW STOCK MAIL] Triggering mail alert for store "${store.name}" to ${recipientEmail} (${lowStockProducts.length} low stock item(s))`
      );
      await sendLowStockNotificationEmail(recipientEmail, {
        storeName: store.name || store.storeName || "Vyapar Sakha Store",
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
  }

  const sale = await Sale.create({
    store: cart.store,
    user: cart.user,
    cart: cart._id,
    buyer: cart.buyer || null,
    customerName: cart.customerName || "Walk-in Customer",
    customerPhone: cart.customerPhone || "",
    customerEmail: cart.customerEmail || "",
    items,
    totalAmount: cart.totalPrice || items.reduce((sum, item) => sum + item.lineTotal, 0),
    subtotal: cart.subtotal || totalAmount,
    discount: cart.discount || { type: "fixed", value: 0, amount: 0 },
    paymentId: cart.paymentId || null,
    paymentMethod: cart.paymentMethod || (cart.paymentId ? cart.paymentId.split("-")[0] : "cash"),
    completedAt: isBackfillForCompletedCart ? cart.updatedAt || new Date() : new Date(),
  });

  console.log(
    `[SALE SERVICE] Created sale snapshot for cart=${cartId} sale=${sale._id} mode=${isBackfillForCompletedCart ? "backfill" : "live"}`
  );

  // Auto-update or create Buyer stats for store
  const phone = cart.customerPhone?.trim();
  const name = cart.customerName?.trim();
  if (cart.buyer || (phone && phone !== "N/A" && phone !== "")) {
    try {
      await createBuyer(cart.store, {
        buyerId: cart.buyer,
        name: name && name !== "Walk-in Customer" ? name : "Customer",
        phone: phone || "N/A",
        email: cart.customerEmail || "",
        totalSales: sale.totalAmount,
        totalPaid: sale.paidAmount,
        totalDue: sale.dueAmount,
      });
    } catch (buyerErr) {
      console.warn("[SALE SERVICE] Could not update buyer stats:", buyerErr.message);
    }
  }

  if (cart.status !== "completed") {
    cart.status = "completed";
    await cart.save();
  }

  // Trigger event-driven notification for store
  notifySaleCreated({
    storeId: cart.store,
    sale,
    user: userId,
  });

  return {
    sale,
    cart,
    inventoryAdjusted: !isBackfillForCompletedCart,
    saleCreated: true,
  };
};
