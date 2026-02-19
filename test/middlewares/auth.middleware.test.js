import { jest } from "@jest/globals";

// Mock Firebase auth
const mockVerifyIdToken = jest.fn();
jest.unstable_mockModule("../../config/firebase.js", () => ({
  auth: {
    verifyIdToken: mockVerifyIdToken,
  },
}));

// Mock auth service
const mockGetUserByFirebaseUid = jest.fn();
jest.unstable_mockModule("../../modules/auth/auth.service.js", () => ({
  getUserByFirebaseUid: mockGetUserByFirebaseUid,
}));

const { default: authMiddleware } =
  await import("../../middlewares/auth.middleware.js");

describe("auth.middleware", () => {
  let req, res, next;

  beforeEach(() => {
    req = {
      method: "GET",
      originalUrl: "/test",
      headers: {},
    };

    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    next = jest.fn();

    mockVerifyIdToken.mockReset();
    mockGetUserByFirebaseUid.mockReset();

    // Suppress console logs in tests
    jest.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    console.log.mockRestore();
  });

  describe("successful authentication", () => {
    test("successfully authenticates with valid token and registered user", async () => {
      const decodedToken = {
        uid: "firebase-uid-123",
        email: "test@example.com",
        name: "Test User",
        email_verified: true,
        picture: "https://example.com/photo.jpg",
      };

      const dbUser = {
        _id: "507f1f77bcf86cd799439011",
        firebaseUid: "firebase-uid-123",
        email: "test@example.com",
        name: "Test User",
        emailVerified: true,
        profilePicture: "https://example.com/photo.jpg",
      };

      req.headers.authorization = "Bearer valid-token-123";

      mockVerifyIdToken.mockResolvedValue(decodedToken);
      mockGetUserByFirebaseUid.mockResolvedValue(dbUser);

      await authMiddleware(req, res, next);

      expect(mockVerifyIdToken).toHaveBeenCalledWith("valid-token-123");
      expect(mockGetUserByFirebaseUid).toHaveBeenCalledWith("firebase-uid-123");

      expect(req.firebaseUser).toEqual({
        uid: "firebase-uid-123",
        email: "test@example.com",
        name: "Test User",
        emailVerified: true,
        picture: "https://example.com/photo.jpg",
      });

      expect(req.user).toEqual(dbUser);
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    test("sets firebaseUser but null user when user not in database", async () => {
      const decodedToken = {
        uid: "firebase-uid-new",
        email: "new@example.com",
        name: "New User",
        email_verified: false,
        picture: null,
      };

      req.headers.authorization = "Bearer valid-token-456";

      mockVerifyIdToken.mockResolvedValue(decodedToken);
      mockGetUserByFirebaseUid.mockRejectedValue(new Error("User not found"));

      await authMiddleware(req, res, next);

      expect(mockVerifyIdToken).toHaveBeenCalledWith("valid-token-456");
      expect(mockGetUserByFirebaseUid).toHaveBeenCalledWith("firebase-uid-new");

      expect(req.firebaseUser).toEqual({
        uid: "firebase-uid-new",
        email: "new@example.com",
        name: "New User",
        emailVerified: false,
        picture: null,
      });

      expect(req.user).toBeNull();
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    test("handles token with minimal user data", async () => {
      const decodedToken = {
        uid: "firebase-uid-minimal",
        email: "minimal@example.com",
        email_verified: false,
      };

      req.headers.authorization = "Bearer minimal-token";

      mockVerifyIdToken.mockResolvedValue(decodedToken);
      mockGetUserByFirebaseUid.mockResolvedValue(null);

      await authMiddleware(req, res, next);

      expect(req.firebaseUser).toEqual({
        uid: "firebase-uid-minimal",
        email: "minimal@example.com",
        name: undefined,
        emailVerified: false,
        picture: undefined,
      });

      expect(next).toHaveBeenCalled();
    });

    test("handles token with all optional fields", async () => {
      const decodedToken = {
        uid: "firebase-uid-complete",
        email: "complete@example.com",
        name: "Complete User",
        email_verified: true,
        picture: "https://example.com/complete.jpg",
      };

      const dbUser = {
        _id: "507f1f77bcf86cd799439012",
        firebaseUid: "firebase-uid-complete",
        email: "complete@example.com",
        name: "Complete User",
      };

      req.headers.authorization = "Bearer complete-token";

      mockVerifyIdToken.mockResolvedValue(decodedToken);
      mockGetUserByFirebaseUid.mockResolvedValue(dbUser);

      await authMiddleware(req, res, next);

      expect(req.firebaseUser.name).toBe("Complete User");
      expect(req.firebaseUser.picture).toBe("https://example.com/complete.jpg");
      expect(req.user).toEqual(dbUser);
      expect(next).toHaveBeenCalled();
    });
  });

  describe("missing or invalid authorization header", () => {
    test("returns 401 when no authorization header provided", async () => {
      await authMiddleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: "Unauthorized - No token provided",
      });
      expect(next).not.toHaveBeenCalled();
      expect(mockVerifyIdToken).not.toHaveBeenCalled();
    });

    test("returns 401 when authorization header is empty string", async () => {
      req.headers.authorization = "";

      await authMiddleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: "Unauthorized - No token provided",
      });
      expect(next).not.toHaveBeenCalled();
    });

    test("returns 401 when authorization header does not start with Bearer", async () => {
      req.headers.authorization = "Basic some-token";

      await authMiddleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: "Unauthorized - No token provided",
      });
      expect(next).not.toHaveBeenCalled();
    });

    test("returns 401 when Bearer keyword is present but no token", async () => {
      req.headers.authorization = "Bearer ";

      await authMiddleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: "Unauthorized - Invalid token format",
      });
      expect(next).not.toHaveBeenCalled();
      expect(mockVerifyIdToken).not.toHaveBeenCalled();
    });

    test("returns 401 when only Bearer with whitespace", async () => {
      req.headers.authorization = "Bearer    ";

      mockVerifyIdToken.mockRejectedValue(new Error("Invalid token"));

      await authMiddleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: "Unauthorized - Invalid token",
      });
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe("token verification failures", () => {
    test("returns 401 when token is expired", async () => {
      req.headers.authorization = "Bearer expired-token";

      const error = new Error("Token expired");
      error.code = "auth/id-token-expired";
      mockVerifyIdToken.mockRejectedValue(error);

      await authMiddleware(req, res, next);

      expect(mockVerifyIdToken).toHaveBeenCalledWith("expired-token");
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: "Token expired - Please login again",
      });
      expect(next).not.toHaveBeenCalled();
    });

    test("returns 401 when token format is invalid (argument error)", async () => {
      req.headers.authorization = "Bearer invalid-format-token";

      const error = new Error("Invalid argument");
      error.code = "auth/argument-error";
      mockVerifyIdToken.mockRejectedValue(error);

      await authMiddleware(req, res, next);

      expect(mockVerifyIdToken).toHaveBeenCalledWith("invalid-format-token");
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: "Invalid token format",
      });
      expect(next).not.toHaveBeenCalled();
    });

    test("returns 401 for generic token verification errors", async () => {
      req.headers.authorization = "Bearer bad-token";

      mockVerifyIdToken.mockRejectedValue(new Error("Verification failed"));

      await authMiddleware(req, res, next);

      expect(mockVerifyIdToken).toHaveBeenCalledWith("bad-token");
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: "Unauthorized - Invalid token",
      });
      expect(next).not.toHaveBeenCalled();
    });

    test("returns 401 when token is tampered", async () => {
      req.headers.authorization = "Bearer tampered-token";

      const error = new Error("Token signature invalid");
      error.code = "auth/invalid-token";
      mockVerifyIdToken.mockRejectedValue(error);

      await authMiddleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: "Unauthorized - Invalid token",
      });
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe("edge cases and error handling", () => {
    test("handles database error when fetching user gracefully", async () => {
      const decodedToken = {
        uid: "firebase-uid-db-error",
        email: "error@example.com",
        email_verified: true,
      };

      req.headers.authorization = "Bearer db-error-token";

      mockVerifyIdToken.mockResolvedValue(decodedToken);
      mockGetUserByFirebaseUid.mockRejectedValue(
        new Error("Database connection failed"),
      );

      await authMiddleware(req, res, next);

      expect(req.firebaseUser).toBeDefined();
      expect(req.user).toBeNull();
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    test("handles case-sensitive Bearer token", async () => {
      req.headers.authorization = "bearer lowercase-token";

      await authMiddleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: "Unauthorized - No token provided",
      });
    });

    test("handles extra spaces in authorization header", async () => {
      const decodedToken = {
        uid: "firebase-uid-spaces",
        email: "spaces@example.com",
        email_verified: true,
      };

      req.headers.authorization = "Bearer  token-with-spaces  ";

      mockVerifyIdToken.mockResolvedValue(decodedToken);
      mockGetUserByFirebaseUid.mockResolvedValue(null);

      await authMiddleware(req, res, next);

      expect(mockVerifyIdToken).toHaveBeenCalledWith(" token-with-spaces  ");
      expect(req.firebaseUser).toBeDefined();
      expect(next).toHaveBeenCalled();
    });

    test("sets req.user and req.firebaseUser for different routes", async () => {
      const decodedToken = {
        uid: "firebase-uid-route",
        email: "route@example.com",
        email_verified: true,
      };

      const dbUser = {
        _id: "507f1f77bcf86cd799439999",
        firebaseUid: "firebase-uid-route",
      };

      req.method = "POST";
      req.originalUrl = "/api/products";
      req.headers.authorization = "Bearer route-token";

      mockVerifyIdToken.mockResolvedValue(decodedToken);
      mockGetUserByFirebaseUid.mockResolvedValue(dbUser);

      await authMiddleware(req, res, next);

      expect(req.firebaseUser.uid).toBe("firebase-uid-route");
      expect(req.user._id).toBe("507f1f77bcf86cd799439999");
      expect(next).toHaveBeenCalled();
    });
  });

  describe("token parsing", () => {
    test("correctly parses token with special characters", async () => {
      const decodedToken = {
        uid: "firebase-uid-special",
        email: "special@example.com",
        email_verified: true,
      };

      req.headers.authorization =
        "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.special-chars-!@#$%";

      mockVerifyIdToken.mockResolvedValue(decodedToken);
      mockGetUserByFirebaseUid.mockResolvedValue(null);

      await authMiddleware(req, res, next);

      expect(mockVerifyIdToken).toHaveBeenCalledWith(
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.special-chars-!@#$%",
      );
      expect(next).toHaveBeenCalled();
    });

    test("correctly parses long JWT token", async () => {
      const decodedToken = {
        uid: "firebase-uid-long",
        email: "long@example.com",
        email_verified: true,
      };

      const longToken = "a".repeat(500);
      req.headers.authorization = `Bearer ${longToken}`;

      mockVerifyIdToken.mockResolvedValue(decodedToken);
      mockGetUserByFirebaseUid.mockResolvedValue(null);

      await authMiddleware(req, res, next);

      expect(mockVerifyIdToken).toHaveBeenCalledWith(longToken);
      expect(next).toHaveBeenCalled();
    });
  });

  describe("firebaseUser object structure", () => {
    test("maps email_verified to emailVerified correctly", async () => {
      const decodedToken = {
        uid: "firebase-uid-mapping",
        email: "mapping@example.com",
        email_verified: true,
      };

      req.headers.authorization = "Bearer mapping-token";

      mockVerifyIdToken.mockResolvedValue(decodedToken);
      mockGetUserByFirebaseUid.mockResolvedValue(null);

      await authMiddleware(req, res, next);

      expect(req.firebaseUser.emailVerified).toBe(true);
      expect(req.firebaseUser.email_verified).toBeUndefined();
    });

    test("includes all expected fields in firebaseUser", async () => {
      const decodedToken = {
        uid: "firebase-uid-fields",
        email: "fields@example.com",
        name: "Fields User",
        email_verified: false,
        picture: "https://example.com/fields.jpg",
        extra_field: "should_not_be_included",
      };

      req.headers.authorization = "Bearer fields-token";

      mockVerifyIdToken.mockResolvedValue(decodedToken);
      mockGetUserByFirebaseUid.mockResolvedValue(null);

      await authMiddleware(req, res, next);

      expect(req.firebaseUser).toEqual({
        uid: "firebase-uid-fields",
        email: "fields@example.com",
        name: "Fields User",
        emailVerified: false,
        picture: "https://example.com/fields.jpg",
      });
      expect(req.firebaseUser.extra_field).toBeUndefined();
    });
  });

  describe("middleware flow control", () => {
    test("calls next() only once on success", async () => {
      const decodedToken = {
        uid: "firebase-uid-once",
        email: "once@example.com",
        email_verified: true,
      };

      req.headers.authorization = "Bearer once-token";

      mockVerifyIdToken.mockResolvedValue(decodedToken);
      mockGetUserByFirebaseUid.mockResolvedValue(null);

      await authMiddleware(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(res.status).not.toHaveBeenCalled();
      expect(res.json).not.toHaveBeenCalled();
    });

    test("does not call next() on authentication failure", async () => {
      req.headers.authorization = "Bearer invalid-token";

      mockVerifyIdToken.mockRejectedValue(new Error("Invalid token"));

      await authMiddleware(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalled();
    });

    test("returns response immediately on missing header", async () => {
      await authMiddleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: "Unauthorized - No token provided",
      });
      expect(next).not.toHaveBeenCalled();
      expect(mockVerifyIdToken).not.toHaveBeenCalled();
      expect(mockGetUserByFirebaseUid).not.toHaveBeenCalled();
    });
  });
});
