import { jest } from "@jest/globals";

const mockCartFindById = jest.fn();
const mockMaterializeSaleFromCart = jest.fn();
const mockAssertCartAccess = jest.fn();

jest.unstable_mockModule("../../../models/index.js", () => ({
  Cart: {
    findById: mockCartFindById,
  },
  Product: {},
}));

jest.unstable_mockModule("../../../modules/sale/sale.service.js", () => ({
  materializeSaleFromCart: mockMaterializeSaleFromCart,
}));

jest.unstable_mockModule(
  "../../../modules/store/storeAccess.service.js",
  () => ({
    assertCartAccess: mockAssertCartAccess,
  })
);

const { confirmPayment } = await import(
  "../../../modules/cart/cart.service.js"
);
const { ApiError } = await import("../../../utils/ApiError.js");

describe("cart.service.confirmPayment", () => {
  beforeEach(() => {
    mockCartFindById.mockReset();
    mockMaterializeSaleFromCart.mockReset();
    mockAssertCartAccess.mockReset();
  });

  test("delegates paid cart completion to sale materialization and returns the completed cart", async () => {
    const sourceCart = {
      _id: "cart-1",
      paymentStatus: "paid",
    };
    const completedCart = {
      _id: "cart-1",
      paymentStatus: "paid",
      status: "completed",
    };

    mockAssertCartAccess.mockResolvedValue(sourceCart);
    mockMaterializeSaleFromCart.mockResolvedValue({
      cart: completedCart,
      saleCreated: true,
    });

    const result = await confirmPayment("cart-1", "user-1");

    expect(mockAssertCartAccess).toHaveBeenCalledWith("cart-1", "user-1");
    expect(mockMaterializeSaleFromCart).toHaveBeenCalledWith("cart-1", "user-1");
    expect(result).toBe(completedCart);
  });

  test("throws when payment is not yet marked paid and skips sale materialization", async () => {
    mockAssertCartAccess.mockResolvedValue({
      _id: "cart-1",
      paymentStatus: "pending",
    });

    let caughtError;
    try {
      await confirmPayment("cart-1", "user-1");
    } catch (error) {
      caughtError = error;
    }

    expect(caughtError).toBeInstanceOf(ApiError);
    expect(caughtError).toMatchObject({
      message: "Payment hasn't been made yet",
      statusCode: 400,
    });
    expect(mockMaterializeSaleFromCart).not.toHaveBeenCalled();
  });

  test("throws when user context is missing", async () => {
    let caughtError;
    try {
      await confirmPayment("cart-1");
    } catch (error) {
      caughtError = error;
    }

    expect(caughtError).toBeInstanceOf(ApiError);
    expect(caughtError).toMatchObject({
      message: "User not registered. Please complete registration first.",
      statusCode: 403,
    });
    expect(mockAssertCartAccess).not.toHaveBeenCalled();
    expect(mockMaterializeSaleFromCart).not.toHaveBeenCalled();
  });
});
