import { jest } from "@jest/globals";

const mockFindOne = jest.fn();
const mockCreate = jest.fn();

jest.unstable_mockModule("../../../../models", () => ({
  Store: {
    findOne: mockFindOne,
    create: mockCreate,
  },
}));

const { createStore } =
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
