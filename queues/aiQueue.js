import { Queue } from "bullmq";
import { getBullMQConnectionOptions } from "../config/redis.js";

const connection = getBullMQConnectionOptions();

// Queue for AI tasks consumed by Python FastAPI service
export const aiQueue = connection
    ? new Queue("ai-tasks", { connection })
    : null;

// Queue for Express background & scheduled cron tasks
export const scheduledQueue = connection
    ? new Queue("scheduled-tasks", { connection })
    : null;

/**
 * Dispatch an AI background task (forecast, document generation, etc.)
 * @param {string} taskName - e.g. 'generate_forecast', 'generate_excel_report'
 * @param {object} payload - Job data
 * @param {object} options - Optional BullMQ job options
 */
export const addAiTask = async (taskName, payload = {}, options = {}) => {
    if (!aiQueue) {
        throw new Error("Redis / BullMQ is not connected.");
    }
    const defaultOptions = {
        attempts: 3,
        backoff: { type: "exponential", delay: 2000 },
        removeOnComplete: { age: 3600, count: 100 },
        removeOnFail: { age: 86400, count: 500 },
        ...options,
    };
    const job = await aiQueue.add(taskName, payload, defaultOptions);
    console.log(`[BullMQ] Enqueued AI Task '${taskName}' with Job ID: ${job.id}`);
    return job;
};

/**
 * Schedule a recurring cron job
 * @param {string} jobName - Unique name of cron job
 * @param {object} payload - Job data payload
 * @param {string} cronExpression - e.g. '0 0 * * *' for daily at midnight
 */
export const addScheduledTask = async (jobName, payload = {}, cronExpression = "0 0 * * *") => {
    if (!scheduledQueue) {
        throw new Error("Redis / BullMQ is not connected.");
    }
    const job = await scheduledQueue.add(jobName, payload, {
        repeat: {
            pattern: cronExpression,
        },
    });
    console.log(`[BullMQ] Scheduled Cron Job '${jobName}' [cron: ${cronExpression}]`);
    return job;
};

/**
 * Get details & status of a job
 */
export const getJobStatus = async (queueType, jobId) => {
    const targetQueue = queueType === "ai" ? aiQueue : scheduledQueue;
    if (!targetQueue) return null;

    const job = await targetQueue.getJob(jobId);
    if (!job) return null;

    const state = await job.getState();
    return {
        jobId: job.id,
        name: job.name,
        state,
        progress: job.progress,
        data: job.data,
        result: job.returnvalue,
        failedReason: job.failedReason,
        timestamp: job.timestamp,
        finishedOn: job.finishedOn,
    };
};
