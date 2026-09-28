import { Worker } from "bullmq";
import { getBullMQConnectionOptions } from "../config/redis.js";
import { executeAutomationWorkflow } from "../modules/automation/automation.service.js";
import Automation from "../models/automation.model.js";

const connection = getBullMQConnectionOptions();

let expressWorker = null;

if (connection) {
    expressWorker = new Worker(
        "scheduled-tasks",
        async (job) => {
            console.log(`[Express Worker] Processing scheduled job '${job.name}' (ID: ${job.id})`);

            // Primary & Fallback Resolution for User Scheduled Automations
            let automationId = job.data?.automationId;

            // Fallback: If automationId is missing in data, lookup Automation by bullJobId (job.name)
            if (!automationId && (job.name.startsWith("auto_") || job.name === "user_scheduled_automation")) {
                try {
                    const doc = await Automation.findOne({ bullJobId: job.name }).select("_id");
                    if (doc) {
                        automationId = doc._id.toString();
                        console.log(`[Express Worker] Resolved automationId '${automationId}' via DB lookup for bullJobId '${job.name}'`);
                    }
                } catch (dbErr) {
                    console.error("[Express Worker] DB lookup error for job:", dbErr.message);
                }
            }

            if (automationId) {
                await executeAutomationWorkflow(automationId);
                return { success: true, automationId, executedAt: new Date().toISOString() };
            }

            switch (job.name) {
                case "send_low_stock_alerts":
                    console.log("📦 [Cron] Executing global low stock alert workflow...");
                    return { success: true, processedAt: new Date().toISOString() };

                case "daily_sales_summary":
                    console.log("📊 [Cron] Compiling daily sales summary reports...");
                    return { success: true, summaryDate: new Date().toISOString() };

                case "trigger_nightly_forecast":
                    console.log("🤖 [Cron] Triggering nightly AI forecasting workflow...");
                    return { success: true, triggered: true };

                default:
                    console.warn(`[Express Worker] Unknown job name: ${job.name}`);
                    return { success: false, reason: "Unknown job name" };
            }
        },
        { connection }
    );

    expressWorker.on("completed", (job, returnvalue) => {
        console.log(`[Express Worker] Job ${job.id} completed:`, returnvalue);
    });

    expressWorker.on("failed", (job, err) => {
        console.error(`[Express Worker] Job ${job?.id} failed:`, err.message);
    });

    console.log("✅ Express BullMQ Worker initialized & listening on 'scheduled-tasks'");
}

export default expressWorker;
