import { jest } from "@jest/globals";
import mongoose from "mongoose";

// Mock Role model
jest.unstable_mockModule("../../models/index.js", () => ({
  Role: {
    insertMany: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
  },
}));

const { Role } = await import("../../models/index.js");
const { seedSystemRoles, createCustomRole } = await import("../../modules/role/role.service.js");

describe("Role Service", () => {
  const storeId = new mongoose.Types.ObjectId().toString();
  const userId = new mongoose.Types.ObjectId().toString();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("seedSystemRoles", () => {
    test("should successfully seed system roles", async () => {
      Role.insertMany.mockResolvedValue([
        { name: "Owner", isSystem: true },
        { name: "Manager", isSystem: true },
        { name: "Cashier", isSystem: true },
      ]);

      const result = await seedSystemRoles(storeId, userId);

      expect(Role.insertMany).toHaveBeenCalledTimes(1);
      expect(result).toHaveLength(3);
    });

    test("should return existing roles if insertMany fails with duplicate key", async () => {
      const duplicateError = new Error("Duplicate key");
      duplicateError.code = 11000;
      Role.insertMany.mockRejectedValue(duplicateError);
      
      const existingRoles = [{ name: "Owner", isSystem: true }];
      Role.find.mockResolvedValue(existingRoles);

      const result = await seedSystemRoles(storeId, userId);

      expect(Role.find).toHaveBeenCalledWith({ store: storeId, isSystem: true });
      expect(result).toEqual(existingRoles);
    });
  });

  describe("createCustomRole", () => {
    test("should create a new custom role", async () => {
      const roleData = {
        name: "Night Cashier",
        permissions: ["billing:view", "billing:create"],
      };

      Role.findOne.mockResolvedValue(null); // No duplicate
      Role.create.mockResolvedValue({ ...roleData, store: storeId, isSystem: false });

      const result = await createCustomRole(storeId, userId, roleData);

      expect(Role.create).toHaveBeenCalledWith(expect.objectContaining({
        name: "Night Cashier",
        isSystem: false,
      }));
      expect(result.name).toBe("Night Cashier");
    });

    test("should throw error if role name already exists in store", async () => {
      Role.findOne.mockResolvedValue({ name: "Manager" });

      await expect(createCustomRole(storeId, userId, { name: "Manager", permissions: [] }))
        .rejects.toThrow("Role with name 'Manager' already exists in this store");
    });
  });
});
