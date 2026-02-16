import {
  describe,
  test,
  expect,
  beforeEach,
  afterEach,
  jest,
} from "@jest/globals";
import requireUser from "../../middlewares/requireUser.middleware.js";

describe("RequireUser Middleware", () => {
  let req, res, next, consoleLogSpy;

  beforeEach(() => {
    // Setup request mock
    req = {
      method: "GET",
      originalUrl: "/api/test",
    };

    // Setup response mock
    res = {
      status: function (code) {
        this.statusCode = code;
        return this;
      },
      json: function (data) {
        this.body = data;
        return this;
      },
    };

    // Setup next function mock
    next = jest.fn();

    // Mock console.log to avoid cluttering test output
    consoleLogSpy = jest.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
  });

  describe("User Not Present", () => {
    test("should return 403 when req.user is undefined", () => {
      req.user = undefined;

      requireUser(req, res, next);

      expect(res.statusCode).toBe(403);
      expect(res.body).toEqual({
        success: false,
        message: "User not registered. Please complete registration first.",
        statusCode: 403,
      });
      expect(next).not.toHaveBeenCalled();
    });

    test("should return 403 when req.user is null", () => {
      req.user = null;

      requireUser(req, res, next);

      expect(res.statusCode).toBe(403);
      expect(res.body).toEqual({
        success: false,
        message: "User not registered. Please complete registration first.",
        statusCode: 403,
      });
      expect(next).not.toHaveBeenCalled();
    });

    test("should return 403 when req.user is false", () => {
      req.user = false;

      requireUser(req, res, next);

      expect(res.statusCode).toBe(403);
      expect(next).not.toHaveBeenCalled();
    });

    test("should return 403 when req.user is 0", () => {
      req.user = 0;

      requireUser(req, res, next);

      expect(res.statusCode).toBe(403);
      expect(next).not.toHaveBeenCalled();
    });

    test("should return 403 when req.user is empty string", () => {
      req.user = "";

      requireUser(req, res, next);

      expect(res.statusCode).toBe(403);
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe("User Present", () => {
    test("should call next() when req.user exists with _id", () => {
      req.user = {
        _id: "user-id-123",
        email: "test@example.com",
        name: "Test User",
      };

      requireUser(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.statusCode).toBeUndefined();
    });

    test("should call next() when req.user is a valid object", () => {
      req.user = {
        _id: "user-id-456",
        email: "another@example.com",
        firebaseUid: "firebase-uid-456",
      };

      requireUser(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.statusCode).toBeUndefined();
    });

    test("should call next() when req.user has only _id field", () => {
      req.user = {
        _id: "minimal-user-id",
      };

      requireUser(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.statusCode).toBeUndefined();
    });
  });

  describe("Edge Cases", () => {
    test("should call next() when req.user is empty object", () => {
      req.user = {};

      requireUser(req, res, next);

      // Empty object is truthy, so it will call next()
      expect(next).toHaveBeenCalled();
    });

    test("should handle req.user with _id as null", () => {
      req.user = {
        _id: null,
        email: "test@example.com",
      };

      requireUser(req, res, next);

      // User object exists, so it should call next()
      expect(next).toHaveBeenCalled();
    });

    test("should work with different HTTP methods", () => {
      req.method = "POST";
      req.originalUrl = "/api/store";
      req.user = {
        _id: "user-id-789",
      };

      requireUser(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    test("should work with different routes", () => {
      req.method = "DELETE";
      req.originalUrl = "/api/store/123";
      req.user = {
        _id: "user-id-999",
      };

      requireUser(req, res, next);

      expect(next).toHaveBeenCalled();
    });
  });

  describe("Logging", () => {
    test("should log request information on entry when user not registered", () => {
      consoleLogSpy.mockRestore();
      const logSpy = jest.spyOn(console, "log").mockImplementation(() => {});

      req.method = "POST";
      req.originalUrl = "/api/store/create";
      req.user = null;

      requireUser(req, res, next);

      expect(logSpy).toHaveBeenCalledWith(
        "[REQUIRE USER] POST /api/store/create",
      );
      expect(logSpy).toHaveBeenCalledWith(
        "[REQUIRE USER] User not registered in database",
      );

      logSpy.mockRestore();
    });

    test("should log user verification success", () => {
      consoleLogSpy.mockRestore();
      const logSpy = jest.spyOn(console, "log").mockImplementation(() => {});

      req.method = "GET";
      req.originalUrl = "/api/user/profile";
      req.user = {
        _id: "user-id-123",
      };

      requireUser(req, res, next);

      expect(logSpy).toHaveBeenCalledWith(
        "[REQUIRE USER] GET /api/user/profile",
      );
      expect(logSpy).toHaveBeenCalledWith(
        "[REQUIRE USER] User verified: user-id-123",
      );

      logSpy.mockRestore();
    });
  });

  describe("Integration Scenarios", () => {
    test("should work correctly after successful authMiddleware execution", () => {
      // Simulate what authMiddleware would set
      req.firebaseUser = {
        uid: "firebase-uid-123",
        email: "test@example.com",
      };
      req.user = {
        _id: "db-user-id-123",
        firebaseUid: "firebase-uid-123",
        email: "test@example.com",
      };

      requireUser(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.statusCode).toBeUndefined();
    });

    test("should fail when authMiddleware set user to null", () => {
      // Simulate authMiddleware finding no user in DB
      req.firebaseUser = {
        uid: "firebase-uid-456",
        email: "new@example.com",
      };
      req.user = null;

      requireUser(req, res, next);

      expect(res.statusCode).toBe(403);
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe("Response Format Validation", () => {
    test("should return correct error structure", () => {
      req.user = null;

      requireUser(req, res, next);

      expect(res.body).toHaveProperty("success");
      expect(res.body).toHaveProperty("message");
      expect(res.body).toHaveProperty("statusCode");
      expect(res.body.success).toBe(false);
      expect(res.body.statusCode).toBe(403);
      expect(typeof res.body.message).toBe("string");
    });

    test("should not modify request object on failure", () => {
      req.user = null;
      const originalUser = req.user;

      requireUser(req, res, next);

      expect(req.user).toBe(originalUser);
    });

    test("should not modify request object on success", () => {
      const mockUser = { _id: "test-id", email: "test@example.com" };
      req.user = mockUser;
      const originalUser = req.user;

      requireUser(req, res, next);

      expect(req.user).toBe(originalUser);
      expect(req.user).toEqual(mockUser);
    });
  });

  describe("Middleware Chain Behavior", () => {
    test("should not call next() multiple times on failure", () => {
      req.user = null;

      requireUser(req, res, next);

      expect(next).toHaveBeenCalledTimes(0);
    });

    test("should call next() exactly once on success", () => {
      req.user = { _id: "test-id" };

      requireUser(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
    });
  });
});
