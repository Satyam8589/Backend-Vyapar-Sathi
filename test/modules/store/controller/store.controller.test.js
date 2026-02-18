import { jest } from "@jest/globals";

const mockCreateStore = jest.fn();

jest.unstable_mockModule("../../../../modules/store/store.service.js", () => ({
  createStore: mockCreateStore,
  getStore: jest.fn(),
  updateStore: jest.fn(),
  deleteStore: jest.fn(),
  getStoresByOwner: jest.fn(),
}));

const { storeCreateController } =
  await import("../../../../modules/store/store.controller.js");

describe("store.controller.storeCreateController", () => {
  beforeEach(() => {
    mockCreateStore.mockReset();
  });

  test("creates store with authenticated user context and returns 201 ApiResponse", async () => {
    const req = {
      body: {
        name: "Main Branch",
        phone: "9999999999",
        address: { fullAddress: "123 Market Road" },
      },
      user: {
        _id: "owner-123",
        firebaseUid: "firebase-uid-123",
      },
    };

    const createdStore = {
      _id: "store-123",
      ...req.body,
      owner: req.user._id,
      ownerFirebaseUid: req.user.firebaseUid,
    };

    const status = jest.fn();
    const json = jest.fn();
    status.mockReturnValue({ json });

    const res = { status, json };

    mockCreateStore.mockResolvedValue(createdStore);

    await storeCreateController(req, res);

    expect(mockCreateStore).toHaveBeenCalledWith({
      name: "Main Branch",
      phone: "9999999999",
      address: { fullAddress: "123 Market Road" },
      owner: "owner-123",
      ownerFirebaseUid: "firebase-uid-123",
    });

    expect(status).toHaveBeenCalledWith(201);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        data: createdStore,
        message: "Store created successfully",
        statusCode: 201,
      }),
    );
  });

  test("handles error when service fails", async () => {
    const req = {
      body: {
        name: "Main Branch",
        phone: "9999999999",
        address: { fullAddress: "123 Market Road" },
      },
      user: {
        _id: "owner-123",
        firebaseUid: "firebase-uid-123",
      },
    };

    const status = jest.fn();
    const json = jest.fn();
    status.mockReturnValue({ json });

    const res = { status, json };

    const mockError = new Error(
      "A store with this name already exists for this owner",
    );
    mockError.statusCode = 409;
    mockCreateStore.mockRejectedValue(mockError);

    await storeCreateController(req, res);

    expect(mockCreateStore).toHaveBeenCalledWith({
      name: "Main Branch",
      phone: "9999999999",
      address: { fullAddress: "123 Market Road" },
      owner: "owner-123",
      ownerFirebaseUid: "firebase-uid-123",
    });

    expect(status).toHaveBeenCalledWith(409);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        data: null,
        message: "A store with this name already exists for this owner",
        statusCode: 409,
      }),
    );
  });
});
