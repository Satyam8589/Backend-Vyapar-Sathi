import { Notification, Inventory } from '../../models/index.js';
import { ApiError } from '../../utils/ApiError.js';
import { getPagination } from '../../utils/pagination.js';

/**
 * Create a new notification with deduplication logic
 */
export const createNotificationService = async ({
  storeId,
  type,
  title,
  message,
  relatedEntityType = null,
  relatedEntityId = null,
  priority = 'LOW',
  userId = null
}) => {
  // Deduplication check for similar active notifications (unread)
  // Especially important for LOW_STOCK and OUT_OF_STOCK
  const duplicateCheckTypes = ['LOW_STOCK', 'OUT_OF_STOCK', 'REORDER_ALERT', 'PURCHASE_ORDER_PENDING', 'PURCHASE_ORDER_OVERDUE'];
  
  if (duplicateCheckTypes.includes(type) && relatedEntityId) {
    const existingUnread = await Notification.findOne({
      store: storeId,
      type,
      relatedEntityId,
      isRead: false
    });

    if (existingUnread) {
      // Don't create a new one, maybe just update the timestamp
      existingUnread.updatedAt = new Date();
      existingUnread.message = message; // Update message in case details changed
      await existingUnread.save();
      return existingUnread;
    }
  }

  // Deduplication for Purchase payment due? We can allow multiple if they are far apart, 
  // but better to keep it to one unread due reminder per purchase.
  if (type === 'PURCHASE_DUE' && relatedEntityId) {
    const existingDue = await Notification.findOne({
      store: storeId,
      type: 'PURCHASE_DUE',
      relatedEntityId,
      isRead: false
    });
    
    if (existingDue) {
      existingDue.updatedAt = new Date();
      existingDue.message = message;
      await existingDue.save();
      return existingDue;
    }
  }

  const notification = new Notification({
    store: storeId,
    type,
    title,
    message,
    relatedEntityType,
    relatedEntityId,
    priority,
    user: userId
  });

  await notification.save();
  return notification;
};

/**
 * Get paginated notifications for a store
 */
export const getNotificationsService = async (storeId, query) => {
  const { limit, skip, page } = getPagination(query);
  const { isRead, type } = query;

  const filter = { store: storeId };
  if (isRead !== undefined) {
    filter.isRead = isRead === 'true';
  }
  if (type) {
    filter.type = type;
  }

  const [notifications, total] = await Promise.all([
    Notification.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('relatedEntityId', 'name invoiceNumber') // Assuming Product has name, Purchase has invoiceNumber
      .lean(),
    Notification.countDocuments(filter)
  ]);

  return {
    notifications,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    }
  };
};

/**
 * Get unread notification count
 */
export const getUnreadCountService = async (storeId) => {
  const count = await Notification.countDocuments({
    store: storeId,
    isRead: false
  });
  return { count };
};

/**
 * Mark a single notification as read
 */
export const markAsReadService = async (storeId, notificationId) => {
  const notification = await Notification.findOneAndUpdate(
    { _id: notificationId, store: storeId },
    { isRead: true },
    { new: true }
  );

  if (!notification) {
    throw new ApiError(404, 'Notification not found');
  }

  return notification;
};

/**
 * Mark all notifications as read for a store
 */
export const markAllAsReadService = async (storeId) => {
  const result = await Notification.updateMany(
    { store: storeId, isRead: false },
    { isRead: true }
  );
  
  return { updatedCount: result.modifiedCount };
};

/**
 * Check and generate stock alerts (Low stock, out of stock)
 */
export const checkInventoryAlertsService = async (storeId, productId, currentStock, reorderLevel) => {
  if (currentStock === 0) {
    // Generate OUT OF STOCK alert
    await createNotificationService({
      storeId,
      type: 'OUT_OF_STOCK',
      title: 'Out of Stock',
      message: 'Product is currently unavailable. Stock is 0.',
      relatedEntityType: 'Product',
      relatedEntityId: productId,
      priority: 'HIGH'
    });
    
    // Resolve LOW_STOCK if it exists? It's better to just let them mark it as read, but we could auto-read it.
    await Notification.updateMany({
      store: storeId,
      type: 'LOW_STOCK',
      relatedEntityId: productId,
      isRead: false
    }, { isRead: true });
    
  } else if (currentStock <= reorderLevel) {
    // Generate LOW STOCK alert
    await createNotificationService({
      storeId,
      type: 'LOW_STOCK',
      title: 'Low Stock Alert',
      message: `Low stock: Product has only ${currentStock} units remaining.`,
      relatedEntityType: 'Product',
      relatedEntityId: productId,
      priority: 'MEDIUM'
    });
    
    // Auto-read OUT_OF_STOCK if any existed
    await Notification.updateMany({
      store: storeId,
      type: 'OUT_OF_STOCK',
      relatedEntityId: productId,
      isRead: false
    }, { isRead: true });
    
  } else {
    // Stock is healthy, auto-resolve any active alerts
    await Notification.updateMany({
      store: storeId,
      type: { $in: ['LOW_STOCK', 'OUT_OF_STOCK', 'REORDER_ALERT'] },
      relatedEntityId: productId,
      isRead: false
    }, { isRead: true });
  }
};
