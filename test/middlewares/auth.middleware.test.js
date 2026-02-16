import {
  describe,
  test,
  expect,
  beforeEach,
  afterEach,
  jest,
} from "@jest/globals";
import authMiddleware from "../../middlewares/auth.middleware.js";

describe("Auth Middleware", () => {
  let req, res, next, consoleLogSpy;

  beforeEach(() => {
    // Setup request mock
    req = {
      method: "GET",
      originalUrl: "/api/test",
      headers: {},
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

  describe("Missing Authorization Header", () => {
    test("should return 401 when authorization header is missing", async () => {
      await authMiddleware(req, res, next);

      expect(res.statusCode).toBe(401);
      expect(res.body).toEqual({
        success: false,
        message: "Unauthorized - No token provided",
      });
      expect(next).not.toHaveBeenCalled();
    });

    test("should return 401 when authorization header is empty string", async () => {
      req.headers.authorization = "";

      await authMiddleware(req, res, next);

      expect(res.statusCode).toBe(401);
      expect(res.body).toEqual({
        success: false,
        message: "Unauthorized - No token provided",
      });
      expect(next).not.toHaveBeenCalled();
    });

    test("should return 401 when authorization header does not start with 'Bearer '", async () => {
      req.headers.authorization = "Basic sometoken123";

      await authMiddleware(req, res, next);

      expect(res.statusCode).toBe(401);
      expect(res.body).toEqual({
        success: false,
        message: "Unauthorized - No token provided",
      });
      expect(next).not.toHaveBeenCalled();
    });

    test("should return 401 when token is empty after 'Bearer '", async () => {
      req.headers.authorization = "Bearer ";

      await authMiddleware(req, res, next);

      expect(res.statusCode).toBe(401);
      expect(res.body).toEqual({
        success: false,
        message: "Unauthorized - Invalid token format",
      });
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe("Invalid Token Format", () => {
    test("should handle malformed Bearer token", async () => {
      req.headers.authorization = "Bearertoken123"; // Missing space

      await authMiddleware(req, res, next);

      expect(res.statusCode).toBe(401);
      expect(res.body.success).toBe(false);
      expect(next).not.toHaveBeenCalled();
    });

    test("should handle authorization with only 'Bearer'", async () => {
      req.headers.authorization = "Bearer";

      await authMiddleware(req, res, next);

      expect(res.statusCode).toBe(401);
      expect(next).not.toHaveBeenCalled();
    });

    test("should handle case-sensitive 'Bearer' keyword", async () => {
      req.headers.authorization = "bearer valid-token";

      await authMiddleware(req, res, next);

      expect(res.statusCode).toBe(401);
      expect(res.body.message).toBe("Unauthorized - No token provided");
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe("Token Validation with Invalid Tokens", () => {
    test("should return 401 for obviously invalid token", async () => {
      req.headers.authorization = "Bearer invalid-token-123";

      await authMiddleware(req, res, next);

      // Will fail at Firebase verification
      expect(res.statusCode).toBe(401);
      expect(res.body.success).toBe(false);
      expect(next).not.toHaveBeenCalled();
    });

    test("should return 401 for token with special characters", async () => {
      req.headers.authorization = "Bearer @@##$$%%";

      await authMiddleware(req, res, next);

      expect(res.statusCode).toBe(401);
      expect(res.body.success).toBe(false);
      expect(next).not.toHaveBeenCalled();
    });

    test("should return 401 for extremely short token", async () => {
      req.headers.authorization = "Bearer abc";

      await authMiddleware(req, res, next);

      expect(res.statusCode).toBe(401);
      expect(res.body.success).toBe(false);
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe("Edge Cases", () => {
    test("should handle authorization header with extra spaces", async () => {
      req.headers.authorization = "Bearer   token-with-spaces   ";

      await authMiddleware(req, res, next);

      // Will attempt verification with the token including spaces
      expect(res.statusCode).toBe(401);
      expect(next).not.toHaveBeenCalled();
    });

    test("should handle multiple Bearer keywords", async () => {
      req.headers.authorization = "Bearer Bearer token";

      await authMiddleware(req, res, next);

      // Token will be "Bearer token" which is invalid
      expect(res.statusCode).toBe(401);
      expect(next).not.toHaveBeenCalled();
    });

    test("should handle null authorization header", async () => {
      req.headers.authorization = null;

      await authMiddleware(req, res, next);

      expect(res.statusCode).toBe(401);
      expect(res.body.message).toBe("Unauthorized - No token provided");
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe("Logging Behavior", () => {
    test("should log authentication attempt", async () => {
      consoleLogSpy.mockRestore();
      const logSpy = jest.spyOn(console, "log").mockImplementation(() => {});

      req.method = "POST";
      req.originalUrl = "/api/store";
      req.headers.authorization = "Bearer some-token";

      await authMiddleware(req, res, next);

      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining("[AUTH MIDDLEWARE] POST /api/store"),
      );

      logSpy.mockRestore();
    });

    test("should log missing token scenario", async () => {
      consoleLogSpy.mockRestore();
      const logSpy = jest.spyOn(console, "log").mockImplementation(() => {});

      await authMiddleware(req, res, next);

      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining("[AUTH MIDDLEWARE]"),
      );

      logSpy.mockRestore();
    });
  });

  describe("Response Structure", () => {
    test("should return proper error structure for unauthorized", async () => {
      await authMiddleware(req, res, next);

      expect(res.body).toHaveProperty("success");
      expect(res.body).toHaveProperty("message");
      expect(res.body.success).toBe(false);
      expect(typeof res.body.message).toBe("string");
    });

    test("should set correct status code", async () => {
      await authMiddleware(req, res, next);

      expect(res.statusCode).toBe(401);
    });
  });

  describe("Middleware Chain", () => {
    test("should not call next() when no token provided", async () => {
      await authMiddleware(req, res, next);

      expect(next).toHaveBeenCalledTimes(0);
    });

    test("should not call next() when invalid token format", async () => {
      req.headers.authorization = "InvalidFormat token";

      await authMiddleware(req, res, next);

      expect(next).toHaveBeenCalledTimes(0);
    });

    test("should not modify request when authentication fails", async () => {
      const originalHeaders = { ...req.headers };

      await authMiddleware(req, res, next);

      expect(req.headers).toEqual(originalHeaders);
      expect(req.user).toBeUndefined();
      expect(req.firebaseUser).toBeUndefined();
    });
  });

  describe("Different HTTP Methods", () => {
    test("should handle GET requests", async () => {
      req.method = "GET";
      req.originalUrl = "/api/user/profile";

      await authMiddleware(req, res, next);

      expect(res.statusCode).toBe(401);
    });

    test("should handle POST requests", async () => {
      req.method = "POST";
      req.originalUrl = "/api/store/create";

      await authMiddleware(req, res, next);

      expect(res.statusCode).toBe(401);
    });

    test("should handle PUT requests", async () => {
      req.method = "PUT";
      req.originalUrl = "/api/store/123";

      await authMiddleware(req, res, next);

      expect(res.statusCode).toBe(401);
    });

    test("should handle DELETE requests", async () => {
      req.method = "DELETE";
      req.originalUrl = "/api/store/123";

      await authMiddleware(req, res, next);

      expect(res.statusCode).toBe(401);
    });
  });

  describe("Error Message Consistency", () => {
    test("should return consistent message for missing token", async () => {
      await authMiddleware(req, res, next);

      expect(res.body.message).toBe("Unauthorized - No token provided");
    });

    test("should return consistent message for empty token", async () => {
      req.headers.authorization = "Bearer ";

      await authMiddleware(req, res, next);

      expect(res.body.message).toBe("Unauthorized - Invalid token format");
    });

    test("should always set success to false on error", async () => {
      const scenarios = [
        {},
        { authorization: "" },
        { authorization: "Bearer " },
        { authorization: "Basic token" },
      ];

      for (const headers of scenarios) {
        req.headers = headers;
        await authMiddleware(req, res, next);
        expect(res.body.success).toBe(false);
      }
    });
  });
});
