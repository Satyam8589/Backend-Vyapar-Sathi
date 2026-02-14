import { ApiError } from '../utils/ApiError.js';

/**
 * Middleware to ensure user exists in database
 * Use this for routes that require a registered user
 * Must be used AFTER authMiddleware
 */
const requireUser = (req, res, next) => {
    if (!req.user) {
        return res.status(403).json({
            success: false,
            message: "User not registered. Please complete registration first.",
            statusCode: 403
        });
    }
    next();
};

export default requireUser;
