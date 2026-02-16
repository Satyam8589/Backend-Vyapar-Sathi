import { ApiError } from "../utils/ApiError.js";

/**
 * Middleware to ensure user exists in database
 * Use this for routes that require a registered user
 * Must be used AFTER authMiddleware
 */
const requireUser = (req, res, next) => {
  console.log(`[REQUIRE USER] ${req.method} ${req.originalUrl}`);

  if (!req.user) {
    console.log("[REQUIRE USER] User not registered in database");
    return res.status(403).json({
      success: false,
      message: "User not registered. Please complete registration first.",
      statusCode: 403,
    });
  }

  console.log(`[REQUIRE USER] User verified: ${req.user._id}`);
  next();
};

export default requireUser;
