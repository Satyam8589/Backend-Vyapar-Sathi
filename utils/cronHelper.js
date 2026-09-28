/**
 * Helper utility to build Cron expressions & calculate execution delays for user automations.
 */

/**
 * Builds standard 5-field cron expression from user schedule parameters
 * @param {object} params
 * @param {string} params.frequency - 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'CRON'
 * @param {string} params.time - HH:mm format (e.g. '09:30')
 * @param {number[]} params.daysOfWeek - Array of numbers 0-6 (0 = Sun, 1 = Mon)
 * @param {number} params.dayOfMonth - Day of month (1-31)
 * @param {string} params.customCron - Optional direct cron string
 * @returns {string} Cron pattern string
 */
export const buildCronExpression = ({
    frequency = "DAILY",
    time = "09:00",
    daysOfWeek = [1],
    dayOfMonth = 1,
    customCron = null,
}) => {
    if (frequency === "CRON" && customCron) {
        return customCron.trim();
    }

    const [hourStr, minStr] = (time || "09:00").split(":");
    const minute = Number(minStr) || 0;
    const hour = Number(hourStr) || 9;

    switch (frequency) {
        case "DAILY":
            // Every day at HH:mm -> "min hour * * *"
            return `${minute} ${hour} * * *`;

        case "WEEKLY": {
            // Specific days of week at HH:mm -> "min hour * * 1,3,5"
            const daysPattern = Array.isArray(daysOfWeek) && daysOfWeek.length > 0
                ? daysOfWeek.join(",")
                : "1";
            return `${minute} ${hour} * * ${daysPattern}`;
        }

        case "MONTHLY": {
            // Specific day of month at HH:mm -> "min hour day * *"
            const validDay = Math.min(Math.max(Number(dayOfMonth) || 1, 1), 31);
            return `${minute} ${hour} ${validDay} * *`;
        }

        default:
            return `${minute} ${hour} * * *`;
    }
};

/**
 * Calculate delay in milliseconds for one-time job execution
 * @param {Date|string} runAt
 * @returns {number} Delay in milliseconds (minimum 0)
 */
export const calculateOneTimeDelay = (runAt) => {
    if (!runAt) return 0;
    const targetDate = new Date(runAt);
    if (isNaN(targetDate.getTime())) return 0;
    const now = new Date();
    const delay = targetDate.getTime() - now.getTime();
    return Math.max(delay, 0);
};

