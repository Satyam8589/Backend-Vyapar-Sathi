import { jest } from "@jest/globals";

// Mock ApiError utility
jest.unstable_mockModule("../../utils/ApiError.js", () => ({
  ApiError: class ApiError extends Error {
    constructor(statusCode, message) {
      super(message);
      this.statusCode = statusCode;
    }
  },
}));

const { default: requireUser } =
  await import("../../middlewares/requireUser.middleware.js");

describe("requireUser.middleware", () => {
  let req, res, next;

  beforeEach(() => {
    req = {
      method: "GET",
      originalUrl: "/test",
      user: null,
    };

    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    next = jest.fn();

    // Suppress console logs in tests
    jest.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    console.log.mockRestore();
  });

  describe("successful user verification", () => {
    test("allows request to continue when user exists in req.user", () => {
      req.user = {
        _id: "507f1f77bcf86cd799439011",
        firebaseUid: "firebase-uid-123",
        email: "test@example.com",
        name: "Test User",
      };

      requireUser(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(res.status).not.toHaveBeenCalled();
      expect(res.json).not.toHaveBeenCalled();
    });

    test("allows request when user has minimal data", () => {
      req.user = {
        _id: "507f1f77bcf86cd799439012",
        firebaseUid: "firebase-uid-minimal",
      };

      requireUser(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(res.status).not.toHaveBeenCalled();
    });

    test("allows request when user object has all properties", () => {
      req.user = {
        _id: "507f1f77bcf86cd799439013",
        firebaseUid: "firebase-uid-complete",
        email: "complete@example.com",
        name: "Complete User",
        emailVerified: true,
        profilePicture: "https://example.com/photo.jpg",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      requireUser(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(res.status).not.toHaveBeenCalled();
    });

    test("works for different HTTP methods - POST", () => {
      req.method = "POST";
      req.originalUrl = "/api/products/add";
      req.user = {
        _id: "507f1f77bcf86cd799439014",
        firebaseUid: "firebase-uid-post",
      };

      requireUser(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
    });

    test("works for different HTTP methods - PUT", () => {
      req.method = "PUT";
      req.originalUrl = "/api/products/123";
      req.user = {
        _id: "507f1f77bcf86cd799439015",
        firebaseUid: "firebase-uid-put",
      };

      requireUser(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
    });

    test("works for different HTTP methods - DELETE", () => {
      req.method = "DELETE";
      req.originalUrl = "/api/products/456";
      req.user = {
        _id: "507f1f77bcf86cd799439016",
        firebaseUid: "firebase-uid-delete",
      };

      requireUser(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
    });
  });

  describe("user not registered scenarios", () => {
    test("returns 403 when req.user is null", () => {
      req.user = null;

      requireUser(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: "User not registered. Please complete registration first.",
        statusCode: 403,
      });
      expect(next).not.toHaveBeenCalled();
    });

    test("returns 403 when req.user is undefined", () => {
      req.user = undefined;

      requireUser(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: "User not registered. Please complete registration first.",
        statusCode: 403,
      });
      expect(next).not.toHaveBeenCalled();
    });

    test("returns 403 when req.user is not set (default)", () => {
      requireUser(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: "User not registered. Please complete registration first.",
        statusCode: 403,
      });
      expect(next).not.toHaveBeenCalled();
    });

    test("returns 403 when req.user is empty object", () => {
      req.user = {};

      // Empty object is still truthy, so it should pass
      requireUser(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(res.status).not.toHaveBeenCalled();
    });

    test("returns 403 when req.user is explicitly set to null after auth", () => {
      req.user = null;
      req.method = "POST";
      req.originalUrl = "/api/products";

      requireUser(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe("edge cases", () => {
    test("handles user with only _id field", () => {
      req.user = {
        _id: "507f1f77bcf86cd799439017",
      };

      requireUser(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(res.status).not.toHaveBeenCalled();
    });

    test("handles user with falsy _id (empty string) but object exists", () => {
      req.user = {
        _id: "",
        firebaseUid: "firebase-uid-empty-id",
      };

      requireUser(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
    });

    test("handles user with extra fields not in schema", () => {
      req.user = {
        _id: "507f1f77bcf86cd799439018",
        firebaseUid: "firebase-uid-extra",
        customField: "custom value",
        anotherField: 12345,
      };

      requireUser(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(res.status).not.toHaveBeenCalled();
    });

    test("does not modify req.user object", () => {
      const originalUser = {
        _id: "507f1f77bcf86cd799439019",
        firebaseUid: "firebase-uid-immutable",
        email: "immutable@example.com",
      };

      req.user = originalUser;

      requireUser(req, res, next);

      expect(req.user).toBe(originalUser);
      expect(req.user).toEqual({
        _id: "507f1f77bcf86cd799439019",
        firebaseUid: "firebase-uid-immutable",
        email: "immutable@example.com",
      });
    });

    test("handles user that is a number (truthy but invalid)", () => {
      req.user = 123;

      requireUser(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
    });

    test("handles user that is a string (truthy but invalid)", () => {
      req.user = "user-string";

      requireUser(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
    });

    test("returns 403 when user is false (falsy)", () => {
      req.user = false;

      requireUser(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(next).not.toHaveBeenCalled();
    });

    test("returns 403 when user is 0 (falsy)", () => {
      req.user = 0;

      requireUser(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(next).not.toHaveBeenCalled();
    });

    test("returns 403 when user is empty string (falsy)", () => {
      req.user = "";

      requireUser(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe("middleware flow control", () => {
    test("calls next() exactly once when user exists", () => {
      req.user = {
        _id: "507f1f77bcf86cd799439020",
        firebaseUid: "firebase-uid-flow",
      };

      requireUser(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(next).toHaveBeenCalledWith();
    });

    test("does not call next() when user is missing", () => {
      req.user = null;

      requireUser(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledTimes(1);
    });

    test("returns immediately when user is missing without further checks", () => {
      req.user = undefined;

      requireUser(req, res, next);

      expect(res.status).toHaveBeenCalledTimes(1);
      expect(res.json).toHaveBeenCalledTimes(1);
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe("response format", () => {
    test("returns correct JSON structure when user is missing", () => {
      req.user = null;

      requireUser(req, res, next);

      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: "User not registered. Please complete registration first.",
        statusCode: 403,
      });
    });

    test("response has success: false when user is missing", () => {
      req.user = undefined;

      requireUser(req, res, next);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
        }),
      );
    });

    test("response has statusCode: 403 when user is missing", () => {
      req.user = null;

      requireUser(req, res, next);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 403,
        }),
      );
    });

    test("response message is descriptive for missing user", () => {
      req.user = null;

      requireUser(req, res, next);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "User not registered. Please complete registration first.",
        }),
      );
    });
  });

  describe("integration with auth middleware", () => {
    test("works correctly after successful auth with user in DB", () => {
      // Simulating that auth middleware set req.user
      req.user = {
        _id: "507f1f77bcf86cd799439021",
        firebaseUid: "firebase-uid-auth-success",
        email: "auth@example.com",
      };

      requireUser(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
    });

    test("blocks request when auth middleware found no user in DB", () => {
      // Simulating that auth middleware set req.user to null
      // (user authenticated via Firebase but not registered in DB)
      req.user = null;
      req.firebaseUser = {
        uid: "firebase-uid-not-registered",
        email: "notregistered@example.com",
      };

      requireUser(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(next).not.toHaveBeenCalled();
    });

    test("maintains separation of concerns - only checks req.user", () => {
      req.firebaseUser = {
        uid: "firebase-uid-exists",
        email: "exists@example.com",
      };
      // req.user is not set

      requireUser(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe("different route scenarios", () => {
    test("protects product creation route", () => {
      req.method = "POST";
      req.originalUrl = "/api/products/add_product";
      req.user = {
        _id: "507f1f77bcf86cd799439022",
        firebaseUid: "firebase-uid-product",
      };

      requireUser(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
    });

    test("protects store management routes", () => {
      req.method = "POST";
      req.originalUrl = "/api/stores/create";
      req.user = {
        _id: "507f1f77bcf86cd799439023",
        firebaseUid: "firebase-uid-store",
      };

      requireUser(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
    });

    test("blocks unregistered user from protected routes", () => {
      req.method = "POST";
      req.originalUrl = "/api/products/add_product";
      req.user = null;

      requireUser(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(next).not.toHaveBeenCalled();
    });

    test("works with query parameters in URL", () => {
      req.method = "GET";
      req.originalUrl = "/api/products?storeId=123&limit=10";
      req.user = {
        _id: "507f1f77bcf86cd799439024",
        firebaseUid: "firebase-uid-query",
      };

      requireUser(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
    });
  });

  describe("response chaining", () => {
    test("status() returns res object for chaining", () => {
      req.user = null;

      requireUser(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.status().json).toBe(res.json);
    });

    test("json() is called on the returned object from status()", () => {
      req.user = undefined;

      requireUser(req, res, next);

      const statusReturn = res.status.mock.results[0].value;
      expect(statusReturn.json).toHaveBeenCalledWith({
        success: false,
        message: "User not registered. Please complete registration first.",
        statusCode: 403,
      });
    });
  });
});
