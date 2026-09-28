import * as automationService from "./automation.service.js";

/**
 * POST /api/automations
 * Create a new user automation rule
 */
export const createAutomation = async (req, res) => {
    try {
        const { title, store, taskType, frequency, time, daysOfWeek, dayOfMonth, runAt, cronExpression, config } = req.body;
        
        if (!title || !taskType) {
            return res.status(400).json({ error: "Title and taskType are required." });
        }

        // Extract user details populated by authMiddleware
        const userId = req.user?._id || req.body.user;
        const userEmail = req.user?.email || req.firebaseUser?.email;

        console.log(`[AUTOMATION] Creating automation '${title}' for User: ${userId} (${userEmail})`);

        const finalConfig = {
            ...config,
            recipientEmail: config?.recipientEmail || userEmail,
        };

        const automation = await automationService.createAutomation({
            title,
            store,
            user: userId,
            taskType,
            frequency,
            time,
            daysOfWeek,
            dayOfMonth,
            runAt,
            cronExpression,
            config: finalConfig,
        });

        return res.status(201).json({
            message: "Automation rule scheduled successfully.",
            automation,
        });
    } catch (err) {
        console.error("Create automation error:", err);
        return res.status(500).json({ error: err.message });
    }
};

/**
 * GET /api/automations
 * Get all automations for store or user
 */
export const getAutomations = async (req, res) => {
    try {
        const { storeId, status } = req.query;
        const filter = {};
        if (storeId) filter.store = storeId;
        if (status) filter.status = status;

        // Filter by logged-in user if available
        if (req.user?._id) {
            filter.user = req.user._id;
        }

        const automations = await automationService.getAutomations(filter);
        return res.status(200).json({ automations });
    } catch (err) {
        console.error("Get automations error:", err);
        return res.status(500).json({ error: err.message });
    }
};

/**
 * PATCH /api/automations/:id/status
 * Toggle status (PAUSED or ACTIVE)
 */
export const toggleStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        if (!["ACTIVE", "PAUSED"].includes(status)) {
            return res.status(400).json({ error: "Status must be 'ACTIVE' or 'PAUSED'" });
        }

        const updated = await automationService.toggleAutomationStatus(id, status);
        return res.status(200).json({ message: `Automation ${status.toLowerCase()}`, automation: updated });
    } catch (err) {
        console.error("Toggle automation error:", err);
        return res.status(500).json({ error: err.message });
    }
};

/**
 * DELETE /api/automations/:id
 * Delete an automation
 */
export const deleteAutomation = async (req, res) => {
    try {
        const { id } = req.params;
        await automationService.deleteAutomation(id);
        return res.status(200).json({ message: "Automation deleted successfully." });
    } catch (err) {
        console.error("Delete automation error:", err);
        return res.status(500).json({ error: err.message });
    }
};

/**
 * POST /api/automations/:id/trigger-now
 * Immediately execute an automation out of schedule
 */
export const triggerNow = async (req, res) => {
    try {
        const { id } = req.params;
        await automationService.executeAutomationWorkflow(id);
        return res.status(200).json({ message: "Automation triggered successfully." });
    } catch (err) {
        console.error("Trigger automation error:", err);
        return res.status(500).json({ error: err.message });
    }
};
