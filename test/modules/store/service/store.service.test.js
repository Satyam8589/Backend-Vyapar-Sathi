import { jest } from "@jest/globals";

const mockFindOne = jest.fn();
const mockCreate = jest.fn();

jest.unstable_mockModule("../../../../models", () => ({
  Store: {
    findOne: mockFindOne,
    create: mockCreate,
  },
}));

const { createStore } = await import("../../../../modules/store/store.service.js");
const { ApiError } = await import("../../../../utils/ApiError.js");

describe("store.service.createStore", () => {
  beforeEach(() => {
    mockFindOne.mockReset();
    mockCreate.mockReset();
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
});
