import { auth } from "../config/firebase.js";
import * as authService from "../modules/auth/auth.service.js";

const authMiddleware = async (req, res, next) => {
  try {
    console.log(`[AUTH MIDDLEWARE] ${req.method} ${req.originalUrl}`);

    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      console.log("[AUTH MIDDLEWARE] No token provided");
      return res.status(401).json({
        success: false,
        message: "Unauthorized - No token provided",
      });
    }

    const token = authHeader.split("Bearer ")[1];

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized - Invalid token format",
      });
    }

    const decodedToken = await auth.verifyIdToken(token);

    console.log(
      `[AUTH MIDDLEWARE] Token verified for user: ${decodedToken.email}`,
    );

    // Store Firebase info separately
    req.firebaseUser = {
      uid: decodedToken.uid,
      email: decodedToken.email,
      name: decodedToken.name,
      emailVerified: decodedToken.email_verified,
      picture: decodedToken.picture,
    };

    // Try to find user in database
    let user = null;
    try {
      user = await authService.getUserByFirebaseUid(decodedToken.uid);
      console.log(`[AUTH MIDDLEWARE] User found in DB: ${user?._id}`);
    } catch (e) {
      // User not found in DB, this is fine for register route
      console.log("[AUTH MIDDLEWARE] User not found in DB");
      user = null;
    }

    // This will be null if user hasn't registered yet
    req.user = user;

    console.log("[AUTH MIDDLEWARE] Authentication successful");
    next();
  } catch (error) {
    if (error.code === "auth/id-token-expired") {
      return res.status(401).json({
        success: false,
        message: "Token expired - Please login again",
      });
    }

    if (error.code === "auth/argument-error") {
      return res.status(401).json({
        success: false,
        message: "Invalid token format",
      });
    }

    return res.status(401).json({
      success: false,
      message: "Unauthorized - Invalid token",
    });
  }
};

export default authMiddleware;
