import { jest } from "@jest/globals";
import mongoose from "mongoose";

// Mock models and utilities
jest.unstable_mockModule("../../models/index.js", () => ({
  Store: {
    findById: jest.fn(),
  },
  Employee: {
    findOne: jest.fn(),
  },
  Role: {
    findOne: jest.fn(),
  },
}));

jest.unstable_mockModule("../../utils/ApiError.js", () => ({
  ApiError: class ApiError extends Error {
    constructor(message, statusCode) {
      super(message);
      this.statusCode = statusCode;
    }
  },
}));

const { Store, Employee } = await import("../../models/index.js");
const { default: requirePermission } = await import("../../middlewares/requirePermission.middleware.js");

describe("requirePermission middleware", () => {
  let req, res, next;
  const storeId = new mongoose.Types.ObjectId().toString();
  const userId = new mongoose.Types.ObjectId().toString();

  beforeEach(() => {
    req = {
      params: { storeId },
      user: { _id: userId },
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    next = jest.fn();
    jest.clearAllMocks();
  });

  test("should allow access if user is the OWNER", async () => {
    Store.findById.mockResolvedValue({
      _id: storeId,
      owner: userId, // Match!
    });

    const middleware = requirePermission("billing:create");
    await middleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.userRole).toBe("owner");
  });

  test("should allow access if user is an EMPLOYEE with correct permission", async () => {
    // 1. Not the owner
    Store.findById.mockResolvedValue({
      _id: storeId,
      owner: new mongoose.Types.ObjectId().toString(),
    });

    // 2. Is an active employee with permission
    const mockEmployee = {
      _id: "emp123",
      role: {
        name: "Cashier",
        permissions: ["billing:view", "billing:create"],
      },
    };

    Employee.findOne.mockReturnValue({
      populate: jest.fn().mockResolvedValue(mockEmployee),
    });

    const middleware = requirePermission("billing:create");
    await middleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.userRole).toBe("Cashier");
  });

  test("should DENY access if employee DOES NOT have the permission", async () => {
    // 1. Not the owner
    Store.findById.mockResolvedValue({
      _id: storeId,
      owner: new mongoose.Types.ObjectId().toString(),
    });

    // 2. Is an active employee but NO permission
    const mockEmployee = {
      _id: "emp123",
      role: {
        name: "Cashier",
        permissions: ["billing:view"], // missing 'billing:create'
      },
    };

    Employee.findOne.mockReturnValue({
      populate: jest.fn().mockResolvedValue(mockEmployee),
    });

    const middleware = requirePermission("billing:create");
    await middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining("billing:create"),
      })
    );
    expect(next).not.toHaveBeenCalled();
  });

  test("should DENY access if user is NOT an employee", async () => {
    Store.findById.mockResolvedValue({
      _id: storeId,
      owner: new mongoose.Types.ObjectId().toString(),
    });

    Employee.findOne.mockReturnValue({
      populate: jest.fn().mockResolvedValue(null), // Not found
    });

    const middleware = requirePermission("billing:create");
    await middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "Access Denied: You do not have permission to access this store.",
      })
    );
  });

  test("should return 400 if storeId is missing in params", async () => {
    req.params.storeId = undefined;

    const middleware = requirePermission("billing:create");
    await middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "Store ID is required in request parameters",
      })
    );
  });
});
