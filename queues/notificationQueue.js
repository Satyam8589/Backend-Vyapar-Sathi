import { Queue } from "bullmq";
import { getBullMQConnectionOptions } from "../config/redis.js";

const connection = getBullMQConnectionOptions();

/**
 * BullMQ Queue for handling event-driven background notifications.
 * Decouples API handlers from notification DB persistence, WebSocket loops, and push API calls.
 */
export const notificationQueue = connection
  ? new Queue("notification-tasks", { connection })
  : null;

/**
 * Enqueue a notification task to be processed asynchronously by BullMQ.
 * 
 * @param {string} taskName - Name/Category of the notification task
 * @param {object} payload - Notification data (storeId, type, title, message, etc.)
 * @param {object} options - BullMQ job options
 */
export const enqueueNotification = async (taskName, payload = {}, options = {}) => {
  const defaultOptions = {
    attempts: 3,
    backoff: { type: "exponential", delay: 1500 },
    removeOnComplete: { age: 3600, count: 500 },
    removeOnFail: { age: 86400, count: 1000 },
    ...options,
  };

  if (notificationQueue) {
    try {
      const job = await notificationQueue.add(taskName, payload, defaultOptions);
      return job;
    } catch (queueErr) {
      console.error(`[BullMQ NotificationQueue] Failed to enqueue job '${taskName}':`, queueErr.message);
    }
  }

  // Graceful fallback if Redis is temporarily offline or not connected
  // Execute via Node setImmediate so caller thread is NEVER blocked
  setImmediate(async () => {
    try {
      const { createNotificationService } = await import("../modules/notification/notification.service.js");
      await createNotificationService(payload);
    } catch (fallbackErr) {
      console.error(`[Notification Fallback] Error processing '${taskName}':`, fallbackErr.message);
    }
  });

  return { id: `fallback-${Date.now()}` };
};
