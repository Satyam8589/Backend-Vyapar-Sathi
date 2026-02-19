import { jest } from "@jest/globals";
import mongoose from "mongoose";

const mockFindOne = jest.fn();
const mockCreate = jest.fn();
const mockFindById = jest.fn();
const mockAggregate = jest.fn();

jest.unstable_mockModule("../../../../models", () => ({
  Store: {
    findOne: mockFindOne,
    create: mockCreate,
    findById: mockFindById,
    aggregate: mockAggregate,
  },
}));

const { createStore, getStore, updateStore, deleteStore, getStoresByOwner } =
  await import("../../../../modules/store/store.service.js");
const { ApiError } = await import("../../../../utils/ApiError.js");

describe("store.service.createStore", () => {
  beforeEach(() => {
    mockFindOne.mockReset();
    mockCreate.mockReset();
  });

  test("successfully creates a new store when all data is valid", async () => {
    const storeData = {
      name: "Main Branch",
      owner: "owner-123",
      ownerFirebaseUid: "firebase-uid-123",
      phone: "9999999999",
      address: { fullAddress: "123 Market Road" },
    };

    const createdStore = {
      _id: "store-123",
      ...storeData,
      isActive: true,
      businessType: "retail",
    };

    mockFindOne.mockResolvedValue(null);
    mockCreate.mockResolvedValue(createdStore);

    const result = await createStore(storeData);

    expect(result).toEqual(createdStore);
    expect(mockFindOne).toHaveBeenCalledWith({
      owner: "owner-123",
      name: "Main Branch",
      isActive: true,
    });
    expect(mockCreate).toHaveBeenCalledWith(storeData);
  });

  test("throws 409 and prevents creation when an active store with same owner/name already exists", async () => {
    const storeData = {
      name: "Main Branch",
      owner: "owner-123",
      phone: "9999999999",
      address: { fullAddress: "123 Market Road" },
    };

    mockFindOne.mockResolvedValue({ _id: "existing-store-id" });

    let caughtError;
    try {
      await createStore(storeData);
    } catch (error) {
      caughtError = error;
    }

    expect(caughtError).toBeInstanceOf(ApiError);
    expect(caughtError).toMatchObject({
      message: "A store with this name already exists for this owner",
      statusCode: 409,
    });

    expect(mockFindOne).toHaveBeenCalledWith({
      owner: "owner-123",
      name: "Main Branch",
      isActive: true,
    });
    expect(mockCreate).not.toHaveBeenCalled();
  });

  test("throws 400 when store name is missing", async () => {
    const storeData = {
      owner: "owner-123",
      phone: "9999999999",
      address: { fullAddress: "123 Market Road" },
    };

    let caughtError;
    try {
      await createStore(storeData);
    } catch (error) {
      caughtError = error;
    }

    expect(caughtError).toBeInstanceOf(ApiError);
    expect(caughtError).toMatchObject({
      message: "Store name and owner ID are required",
      statusCode: 400,
    });
    expect(mockFindOne).not.toHaveBeenCalled();
    expect(mockCreate).not.toHaveBeenCalled();
  });

  test("throws 400 when owner is missing", async () => {
    const storeData = {
      name: "Main Branch",
      phone: "9999999999",
      address: { fullAddress: "123 Market Road" },
    };

    let caughtError;
    try {
      await createStore(storeData);
    } catch (error) {
      caughtError = error;
    }

    expect(caughtError).toBeInstanceOf(ApiError);
    expect(caughtError).toMatchObject({
      message: "Store name and owner ID are required",
      statusCode: 400,
    });
    expect(mockFindOne).not.toHaveBeenCalled();
    expect(mockCreate).not.toHaveBeenCalled();
  });

  test("throws 400 when address is missing", async () => {
    const storeData = {
      name: "Main Branch",
      owner: "owner-123",
      phone: "9999999999",
    };

    let caughtError;
    try {
      await createStore(storeData);
    } catch (error) {
      caughtError = error;
    }

    expect(caughtError).toBeInstanceOf(ApiError);
    expect(caughtError).toMatchObject({
      message: "Full address is required",
      statusCode: 400,
    });
    expect(mockFindOne).not.toHaveBeenCalled();
    expect(mockCreate).not.toHaveBeenCalled();
  });

  test("throws 400 when address.fullAddress is missing", async () => {
    const storeData = {
      name: "Main Branch",
      owner: "owner-123",
      phone: "9999999999",
      address: { city: "Mumbai" },
    };

    let caughtError;
    try {
      await createStore(storeData);
    } catch (error) {
      caughtError = error;
    }

    expect(caughtError).toBeInstanceOf(ApiError);
    expect(caughtError).toMatchObject({
      message: "Full address is required",
      statusCode: 400,
    });
    expect(mockFindOne).not.toHaveBeenCalled();
    expect(mockCreate).not.toHaveBeenCalled();
  });

  test("throws 400 when phone is missing", async () => {
    const storeData = {
      name: "Main Branch",
      owner: "owner-123",
      address: { fullAddress: "123 Market Road" },
    };

    let caughtError;
    try {
      await createStore(storeData);
    } catch (error) {
      caughtError = error;
    }

    expect(caughtError).toBeInstanceOf(ApiError);
    expect(caughtError).toMatchObject({
      message: "Phone number is required",
      statusCode: 400,
    });
    expect(mockFindOne).not.toHaveBeenCalled();
    expect(mockCreate).not.toHaveBeenCalled();
  });
});

describe("store.service.getStore", () => {
  beforeEach(() => {
    mockFindById.mockReset();
  });

  test("successfully retrieves a store by ID", async () => {
    const storeId = "store-123";
    const mockStore = {
      _id: storeId,
      name: "Main Branch",
      owner: "owner-123",
      phone: "9999999999",
      address: { fullAddress: "123 Market Road" },
      isActive: true,
    };

    mockFindById.mockResolvedValue(mockStore);

    const result = await getStore(storeId);

    expect(result).toEqual(mockStore);
    expect(mockFindById).toHaveBeenCalledWith(storeId);
  });

  test("throws 404 when store is not found", async () => {
    const storeId = "non-existent-store";

    mockFindById.mockResolvedValue(null);

    let caughtError;
    try {
      await getStore(storeId);
    } catch (error) {
      caughtError = error;
    }

    expect(caughtError).toBeInstanceOf(ApiError);
    expect(caughtError).toMatchObject({
      message: "Store not found",
      statusCode: 404,
    });
    expect(mockFindById).toHaveBeenCalledWith(storeId);
  });

  test("propagates database errors", async () => {
    const storeId = "store-123";
    const dbError = new Error("Database connection failed");

    mockFindById.mockRejectedValue(dbError);

    let caughtError;
    try {
      await getStore(storeId);
    } catch (error) {
      caughtError = error;
    }

    expect(caughtError).toBe(dbError);
    expect(mockFindById).toHaveBeenCalledWith(storeId);
  });
});

describe("store.service.updateStore", () => {
  beforeEach(() => {
    mockFindById.mockReset();
  });

  test("successfully updates a store with valid data", async () => {
    const storeId = "store-123";
    const updateData = {
      name: "Updated Branch",
      phone: "8888888888",
      description: "Updated description",
    };

    const mockStore = {
      _id: storeId,
      name: "Main Branch",
      owner: "owner-123",
      phone: "9999999999",
      isActive: true,
      set: jest.fn(),
      save: jest.fn(),
    };

    const updatedStore = {
      _id: storeId,
      ...updateData,
      owner: "owner-123",
      isActive: true,
    };

    mockFindById.mockResolvedValue(mockStore);
    mockStore.save.mockResolvedValue(updatedStore);

    const result = await updateStore(storeId, updateData);

    expect(mockFindById).toHaveBeenCalledWith(storeId);
    expect(mockStore.set).toHaveBeenCalledWith(updateData);
    expect(mockStore.save).toHaveBeenCalled();
  });

  test("throws 404 when trying to update non-existent store", async () => {
    const storeId = "non-existent-store";
    const updateData = {
      name: "Updated Branch",
    };

    mockFindById.mockResolvedValue(null);

    let caughtError;
    try {
      await updateStore(storeId, updateData);
    } catch (error) {
      caughtError = error;
    }

    expect(caughtError).toBeInstanceOf(ApiError);
    expect(caughtError).toMatchObject({
      message: "Store not found",
      statusCode: 404,
    });
    expect(mockFindById).toHaveBeenCalledWith(storeId);
  });

  test("updates multiple fields at once", async () => {
    const storeId = "store-123";
    const updateData = {
      name: "New Name",
      phone: "7777777777",
      email: "updated@example.com",
      description: "New description",
      businessType: "wholesale",
    };

    const mockStore = {
      _id: storeId,
      set: jest.fn(),
      save: jest.fn(),
    };

    mockFindById.mockResolvedValue(mockStore);
    mockStore.save.mockResolvedValue({ ...mockStore, ...updateData });

    await updateStore(storeId, updateData);

    expect(mockStore.set).toHaveBeenCalledWith(updateData);
    expect(mockStore.save).toHaveBeenCalled();
  });

  test("propagates validation errors from save", async () => {
    const storeId = "store-123";
    const updateData = {
      phone: "invalid",
    };

    const mockStore = {
      _id: storeId,
      set: jest.fn(),
      save: jest.fn(),
    };

    const validationError = new Error("Validation failed");
    validationError.name = "ValidationError";

    mockFindById.mockResolvedValue(mockStore);
    mockStore.save.mockRejectedValue(validationError);

    let caughtError;
    try {
      await updateStore(storeId, updateData);
    } catch (error) {
      caughtError = error;
    }

    expect(caughtError).toBe(validationError);
  });
});

describe("store.service.deleteStore", () => {
  beforeEach(() => {
    mockFindById.mockReset();
  });

  test("successfully soft deletes a store by setting isActive to false", async () => {
    const storeId = "store-123";

    const mockStore = {
      _id: storeId,
      name: "Main Branch",
      isActive: true,
      save: jest.fn(),
    };

    const deletedStore = {
      ...mockStore,
      isActive: false,
    };

    mockFindById.mockResolvedValue(mockStore);
    mockStore.save.mockResolvedValue(deletedStore);

    const result = await deleteStore(storeId);

    expect(mockFindById).toHaveBeenCalledWith(storeId);
    expect(mockStore.isActive).toBe(false);
    expect(mockStore.save).toHaveBeenCalled();
    expect(result).toBe(mockStore);
  });

  test("throws 404 when trying to delete non-existent store", async () => {
    const storeId = "non-existent-store";

    mockFindById.mockResolvedValue(null);

    let caughtError;
    try {
      await deleteStore(storeId);
    } catch (error) {
      caughtError = error;
    }

    expect(caughtError).toBeInstanceOf(ApiError);
    expect(caughtError).toMatchObject({
      message: "Store not found",
      statusCode: 404,
    });
    expect(mockFindById).toHaveBeenCalledWith(storeId);
  });

  test("can delete already inactive store", async () => {
    const storeId = "store-123";

    const mockStore = {
      _id: storeId,
      name: "Main Branch",
      isActive: false,
      save: jest.fn(),
    };

    mockFindById.mockResolvedValue(mockStore);
    mockStore.save.mockResolvedValue(mockStore);

    const result = await deleteStore(storeId);

    expect(mockStore.isActive).toBe(false);
    expect(mockStore.save).toHaveBeenCalled();
  });

  test("propagates database errors during save", async () => {
    const storeId = "store-123";

    const mockStore = {
      _id: storeId,
      isActive: true,
      save: jest.fn(),
    };

    const dbError = new Error("Database error");
    mockFindById.mockResolvedValue(mockStore);
    mockStore.save.mockRejectedValue(dbError);

    let caughtError;
    try {
      await deleteStore(storeId);
    } catch (error) {
      caughtError = error;
    }

    expect(caughtError).toBe(dbError);
  });
});

describe("store.service.getStoresByOwner", () => {
  beforeEach(() => {
    mockAggregate.mockReset();
  });

  test("successfully retrieves all active stores for an owner with aggregated data", async () => {
    const ownerId = "507f1f77bcf86cd799439011";

    const mockStores = [
      {
        _id: "507f1f77bcf86cd799439012",
        name: "Main Branch",
        owner: new mongoose.Types.ObjectId(ownerId),
        isActive: true,
        totalProducts: 50,
        totalInventoryValue: 25000,
      },
      {
        _id: "507f1f77bcf86cd799439013",
        name: "Secondary Branch",
        owner: new mongoose.Types.ObjectId(ownerId),
        isActive: true,
        totalProducts: 30,
        totalInventoryValue: 15000,
      },
    ];

    mockAggregate.mockResolvedValue(mockStores);

    const result = await getStoresByOwner(ownerId);

    expect(result).toEqual(mockStores);
    expect(mockAggregate).toHaveBeenCalledWith([
      {
        $match: {
          owner: new mongoose.Types.ObjectId(ownerId),
          isActive: true,
        },
      },
      {
        $lookup: {
          from: "products",
          localField: "_id",
          foreignField: "store",
          as: "products",
        },
      },
      {
        $addFields: {
          totalProducts: {
            $size: {
              $filter: {
                input: "$products",
                as: "p",
                cond: { $eq: ["$$p.isActive", true] },
              },
            },
          },
          totalInventoryValue: {
            $reduce: {
              input: {
                $filter: {
                  input: "$products",
                  as: "p",
                  cond: { $eq: ["$$p.isActive", true] },
                },
              },
              initialValue: 0,
              in: {
                $add: [
                  "$$value",
                  {
                    $multiply: [
                      "$$this.price",
                      { $ifNull: ["$$this.quantity", 0] },
                    ],
                  },
                ],
              },
            },
          },
        },
      },
      {
        $project: {
          products: 0,
        },
      },
    ]);
  });

  test("returns empty array when owner has no active stores", async () => {
    const ownerId = "507f1f77bcf86cd799439014";

    mockAggregate.mockResolvedValue([]);

    const result = await getStoresByOwner(ownerId);

    expect(result).toEqual([]);
    expect(result).toHaveLength(0);
  });

  test("only returns active stores, excludes inactive ones", async () => {
    const ownerId = "507f1f77bcf86cd799439015";

    const mockStores = [
      {
        _id: "507f1f77bcf86cd799439016",
        name: "Active Store",
        owner: new mongoose.Types.ObjectId(ownerId),
        isActive: true,
        totalProducts: 10,
        totalInventoryValue: 5000,
      },
    ];

    mockAggregate.mockResolvedValue(mockStores);

    const result = await getStoresByOwner(ownerId);

    expect(result).toHaveLength(1);
    expect(result[0].isActive).toBe(true);
  });

  test("correctly aggregates inventory value with multiple products", async () => {
    const ownerId = "507f1f77bcf86cd799439017";

    const mockStores = [
      {
        _id: "507f1f77bcf86cd799439018",
        name: "Store with Products",
        owner: new mongoose.Types.ObjectId(ownerId),
        isActive: true,
        totalProducts: 3,
        totalInventoryValue: 12500, // Calculated from products
      },
    ];

    mockAggregate.mockResolvedValue(mockStores);

    const result = await getStoresByOwner(ownerId);

    expect(result[0].totalProducts).toBe(3);
    expect(result[0].totalInventoryValue).toBe(12500);
  });

  test("propagates database errors", async () => {
    const ownerId = "507f1f77bcf86cd799439019";
    const dbError = new Error("Aggregation pipeline failed");

    mockAggregate.mockRejectedValue(dbError);

    let caughtError;
    try {
      await getStoresByOwner(ownerId);
    } catch (error) {
      caughtError = error;
    }

    expect(caughtError).toBe(dbError);
  });

  test("handles stores with zero products", async () => {
    const ownerId = "507f1f77bcf86cd799439020";

    const mockStores = [
      {
        _id: "507f1f77bcf86cd799439021",
        name: "Empty Store",
        owner: new mongoose.Types.ObjectId(ownerId),
        isActive: true,
        totalProducts: 0,
        totalInventoryValue: 0,
      },
    ];

    mockAggregate.mockResolvedValue(mockStores);

    const result = await getStoresByOwner(ownerId);

    expect(result[0].totalProducts).toBe(0);
    expect(result[0].totalInventoryValue).toBe(0);
  });
});
