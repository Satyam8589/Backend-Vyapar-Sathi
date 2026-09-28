import mongoose from "mongoose";

const automationSchema = new mongoose.Schema(
    {
        title: {
            type: String,
            required: [true, "Automation title is required"],
            trim: true,
        },
        store: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Store",
            index: true,
        },
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            index: true,
        },
        taskType: {
            type: String,
            enum: ["LOW_STOCK_ALERT", "SALES_SUMMARY", "AI_DEMAND_FORECAST", "EXCEL_REPORT_EXPORT", "CUSTOM_PROMPT"],
            required: [true, "Task type is required"],
        },
        frequency: {
            type: String,
            enum: ["ONCE", "DAILY", "WEEKLY", "MONTHLY", "CRON"],
            default: "DAILY",
        },
        time: {
            type: String,
            default: "09:00", // 24-hour format HH:mm
        },
        daysOfWeek: {
            type: [Number], // 0 = Sun, 1 = Mon, ..., 6 = Sat
            default: [1],
        },
        dayOfMonth: {
            type: Number, // 1 - 31
            default: 1,
        },
        runAt: {
            type: Date, // For ONCE frequency
        },
        cronExpression: {
            type: String, // e.g. "0 9 * * *"
        },
        bullJobId: {
            type: String,
            index: true,
        },
        status: {
            type: String,
            enum: ["ACTIVE", "PAUSED", "COMPLETED"],
            default: "ACTIVE",
            index: true,
        },
        config: {
            recipientEmail: { type: String },
            threshold: { type: Number, default: 10 },
            promptText: { type: String },
            timeframe: { type: String, default: "30d" },
        },
        lastRunAt: {
            type: Date,
        },
        nextRunAt: {
            type: Date,
        },
        runCount: {
            type: Number,
            default: 0,
        },
        lastExecutionStatus: {
            type: String,
            enum: ["SUCCESS", "FAILED", "PENDING"],
            default: "PENDING",
        },
        lastError: {
            type: String,
        },
    },
    { timestamps: true }
);

automationSchema.index({ store: 1, status: 1 });

const Automation = mongoose.model("Automation", automationSchema);

export default Automation;
