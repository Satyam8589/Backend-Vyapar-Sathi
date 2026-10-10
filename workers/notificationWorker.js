import { Worker } from "bullmq";
import { getBullMQConnectionOptions } from "../config/redis.js";
import { createNotificationService } from "../modules/notification/notification.service.js";

const connection = getBullMQConnectionOptions();

let notificationWorker = null;

if (connection) {
  notificationWorker = new Worker(
    "notification-tasks",
    async (job) => {
      const { name, data } = job;
      console.log(`[Notification Worker] 📩 Processing job '${name}' (Job ID: ${job.id}) for store: ${data.storeId}`);

      try {
        const notification = await createNotificationService({
          storeId: data.storeId,
          type: data.type,
          title: data.title,
          message: data.message,
          relatedEntityType: data.relatedEntityType || null,
          relatedEntityId: data.relatedEntityId || null,
          priority: data.priority || 'LOW',
          userId: data.userId || null,
        });

        return {
          success: true,
          notificationId: notification?._id,
          storeId: data.storeId,
          type: data.type,
          processedAt: new Date().toISOString(),
        };
      } catch (err) {
        console.error(`[Notification Worker] ❌ Error creating notification for job ${job.id}:`, err.message);
        throw err; // Trigger BullMQ retry with exponential backoff
      }
    },
    {
      connection,
      concurrency: 5, // Process up to 5 concurrent notification jobs without bottlenecking
    }
  );

  notificationWorker.on("completed", (job, result) => {
    console.log(`[Notification Worker] ✅ Job ${job.id} (${job.name}) completed successfully:`, result?.type);
  });

  notificationWorker.on("failed", (job, err) => {
    console.error(`[Notification Worker] ⚠️ Job ${job?.id} failed after ${job?.attemptsMade} attempts:`, err.message);
  });

  console.log("✅ Express BullMQ Worker initialized & listening on 'notification-tasks'");
}

export default notificationWorker;
