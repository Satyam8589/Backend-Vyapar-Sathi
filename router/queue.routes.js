import express from "express";
import { addAiTask, addScheduledTask, getJobStatus } from "../queues/aiQueue.js";

const router = express.Router();

/**
 * POST /api/queue/task
 * Enqueue an async AI task
 */
router.post("/task", async (req, res) => {
    try {
        const { taskName, payload, options } = req.body;
        if (!taskName) {
            return res.status(400).json({ error: "taskName is required" });
        }

        const job = await addAiTask(taskName, payload || {}, options || {});
        return res.status(202).json({
            status: "queued",
            jobId: job.id,
            taskName,
            message: `Task '${taskName}' successfully enqueued.`,
        });
    } catch (err) {
        console.error("Queue task error:", err);
        return res.status(500).json({ error: err.message });
    }
});

/**
 * GET /api/queue/status/:queueType/:jobId
 * Check job status (queueType can be 'ai' or 'scheduled')
 */
router.get("/status/:queueType/:jobId", async (req, res) => {
    try {
        const { queueType, jobId } = req.params;
        const jobInfo = await getJobStatus(queueType, jobId);

        if (!jobInfo) {
            return res.status(404).json({ error: "Job not found" });
        }

        return res.status(200).json(jobInfo);
    } catch (err) {
        console.error("Queue status error:", err);
        return res.status(500).json({ error: err.message });
    }
});

/**
 * POST /api/queue/schedule-cron
 * Register a recurring cron job
 */
router.post("/schedule-cron", async (req, res) => {
    try {
        const { jobName, payload, cronExpression } = req.body;
        if (!jobName || !cronExpression) {
            return res.status(400).json({ error: "jobName and cronExpression are required" });
        }

        const job = await addScheduledTask(jobName, payload || {}, cronExpression);
        return res.status(201).json({
            status: "scheduled",
            jobId: job.id,
            jobName,
            cronExpression,
            message: `Cron job '${jobName}' registered with expression '${cronExpression}'.`,
        });
    } catch (err) {
        console.error("Schedule cron error:", err);
        return res.status(500).json({ error: err.message });
    }
});

export default router;
