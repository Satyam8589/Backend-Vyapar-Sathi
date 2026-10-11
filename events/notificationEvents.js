import { enqueueNotification } from "../queues/notificationQueue.js";

/**
 * Centralized Event-Driven Notification System.
 * Every notification in the system is published here and pushed to BullMQ asynchronously.
 * API endpoints return instantly without being blocked by notification DB writes, WebSocket sends, or Push API latencies.
 */

/**
 * Core event emitter
 */
export const emitNotification = (taskName, payload) => {
  if (!payload || !payload.storeId) {
    console.warn(`[Notification Event] Ignored event '${taskName}': storeId is required.`);
    return;
  }

  // Non-blocking asynchronous dispatch via BullMQ
  enqueueNotification(taskName, payload).catch((err) => {
    console.error(`[Notification Event] Failed to enqueue '${taskName}':`, err.message);
  });
};

/**
 * 1. SALE EVENTS
 */
export const notifySaleCreated = ({ storeId, sale, user = null }) => {
  emitNotification("sale_created", {
    storeId,
    type: "SALE_CREATED",
    title: "New Sale Completed",
    message: `Sale of ₹${sale.totalAmount} completed for ${sale.customerName || "Customer"}.`,
    relatedEntityType: "Sale",
    relatedEntityId: sale._id || sale.id,
    priority: "LOW",
    userId: user?._id || user,
  });
};

/**
 * 2. GRN (GOODS RECEIVED NOTE) EVENTS
 */
export const notifyGRNCreated = ({ storeId, grn, poNumber, user = null }) => {
  emitNotification("grn_created", {
    storeId,
    type: "GRN_CREATED",
    title: "Goods Received (GRN)",
    message: `GRN ${grn.grnNumber} generated successfully${poNumber ? ` for PO ${poNumber}` : ""}.`,
    relatedEntityType: "GRN",
    relatedEntityId: grn._id || grn.id,
    priority: "LOW",
    userId: user?._id || user,
  });
};

/**
 * 3. PURCHASE & PAYMENT EVENTS
 */
export const notifyPurchaseCreated = ({ storeId, purchase, user = null }) => {
  emitNotification("purchase_created", {
    storeId,
    type: "PURCHASE_CREATED",
    title: "Purchase Created",
    message: `Purchase invoice ${purchase.invoiceNumber} created successfully.`,
    relatedEntityType: "Purchase",
    relatedEntityId: purchase._id || purchase.id,
    priority: "LOW",
    userId: user?._id || user,
  });

  if (purchase.dueAmount > 0) {
    emitNotification("purchase_due", {
      storeId,
      type: "PURCHASE_DUE",
      title: "Payment Due",
      message: `₹${purchase.dueAmount} due for Purchase ${purchase.invoiceNumber}.`,
      relatedEntityType: "Purchase",
      relatedEntityId: purchase._id || purchase.id,
      priority: "MEDIUM",
      userId: user?._id || user,
    });
  }
};

export const notifyPurchaseUpdated = ({ storeId, purchase, user = null }) => {
  emitNotification("purchase_updated", {
    storeId,
    type: "PURCHASE_UPDATED",
    title: "Purchase Updated",
    message: `Purchase invoice ${purchase.invoiceNumber} has been updated.`,
    relatedEntityType: "Purchase",
    relatedEntityId: purchase._id || purchase.id,
    priority: "LOW",
    userId: user?._id || user,
  });
};

export const notifyPurchaseReturned = ({ storeId, returnRecord, invoiceNumber, user = null }) => {
  emitNotification("purchase_returned", {
    storeId,
    type: "PURCHASE_RETURNED",
    title: "Purchase Return",
    message: `Items returned for Purchase ${invoiceNumber || ""}.`,
    relatedEntityType: "PurchaseReturn",
    relatedEntityId: returnRecord._id || returnRecord.id,
    priority: "MEDIUM",
    userId: user?._id || user,
  });
};

export const notifyPaymentReceived = ({ storeId, amount, invoiceNumber, user = null }) => {
  emitNotification("payment_received", {
    storeId,
    type: "PAYMENT_RECEIVED",
    title: "Payment Recorded",
    message: `Payment of ₹${amount} recorded for Invoice ${invoiceNumber}.`,
    relatedEntityType: "Purchase",
    priority: "LOW",
    userId: user?._id || user,
  });
};

/**
 * 4. PURCHASE ORDER EVENTS
 */
export const notifyPurchaseOrderPending = ({ storeId, po, user = null }) => {
  emitNotification("purchase_order_pending", {
    storeId,
    type: "PURCHASE_ORDER_PENDING",
    title: "Purchase Order Pending",
    message: `Purchase Order ${po.poNumber} is waiting for approval.`,
    relatedEntityType: "PurchaseOrder",
    relatedEntityId: po._id || po.id,
    priority: "MEDIUM",
    userId: user?._id || user,
  });
};

export const notifyPurchaseOrderOverdue = ({ storeId, po, user = null }) => {
  emitNotification("purchase_order_overdue", {
    storeId,
    type: "PURCHASE_ORDER_OVERDUE",
    title: "Purchase Order Overdue",
    message: `Purchase Order ${po.poNumber} has passed its expected delivery date.`,
    relatedEntityType: "PurchaseOrder",
    relatedEntityId: po._id || po.id,
    priority: "HIGH",
    userId: user?._id || user,
  });
};

/**
 * 5. INVENTORY & STOCK ALERTS
 */
export const notifyStockAlert = ({ storeId, type, productName, currentStock, minStock, productId = null }) => {
  const isOutOfStock = type === "OUT_OF_STOCK" || currentStock <= 0;
  emitNotification("inventory_stock_alert", {
    storeId,
    type: isOutOfStock ? "OUT_OF_STOCK" : "LOW_STOCK",
    title: isOutOfStock ? "Out of Stock Alert" : "Low Stock Alert",
    message: `Product "${productName}" is ${isOutOfStock ? "out of stock" : `low on stock (${currentStock} left, min: ${minStock})`}.`,
    relatedEntityType: "Product",
    relatedEntityId: productId,
    priority: "HIGH",
  });
};
