import { jest } from "@jest/globals";

const mockProductFindByIdAndUpdate = jest.fn();
const mockSaleFindOne = jest.fn();
const mockSaleCreate = jest.fn();
const mockAssertCartAccess = jest.fn();

jest.unstable_mockModule("../../../models/index.js", () => ({
  Product: {
    findByIdAndUpdate: mockProductFindByIdAndUpdate,
  },
  Sale: {
    findOne: mockSaleFindOne,
    create: mockSaleCreate,
  },
}));

jest.unstable_mockModule(
  "../../../modules/store/storeAccess.service.js",
  () => ({
    assertCartAccess: mockAssertCartAccess,
  })
);

const { materializeSaleFromCart } = await import(
  "../../../modules/sale/sale.service.js"
);

const buildCart = (overrides = {}) => ({
  _id: "cart-1",
  store: "store-1",
  user: "user-1",
  paymentId: "cash-123",
  paymentStatus: "paid",
  status: "payment_pending",
  totalPrice: 140,
  updatedAt: new Date("2026-04-10T10:00:00.000Z"),
  products: [
    {
      product: {
        _id: "product-1",
        name: "Rice Bag",
        category: "Grocery",
        price: 70,
        quantity: 10,
        isActive: true,
      },
      quantity: 2,
      price: 70,
    },
  ],
  save: jest.fn().mockResolvedValue(undefined),
  ...overrides,
});

describe("sale.service.materializeSaleFromCart", () => {
  beforeEach(() => {
    mockProductFindByIdAndUpdate.mockReset();
    mockSaleFindOne.mockReset();
    mockSaleCreate.mockReset();
    mockAssertCartAccess.mockReset();
  });

  test("creates a sale snapshot, decrements inventory, and completes the cart for a paid live cart", async () => {
    const cart = buildCart();
    const createdSale = { _id: "sale-1" };

    mockAssertCartAccess.mockResolvedValue(cart);
    mockSaleFindOne.mockResolvedValue(null);
    mockSaleCreate.mockResolvedValue(createdSale);

    const result = await materializeSaleFromCart("cart-1", "user-1");

    expect(mockAssertCartAccess).toHaveBeenCalledWith(
      "cart-1",
      "user-1",
      "products.product"
    );
    expect(mockProductFindByIdAndUpdate).toHaveBeenCalledTimes(1);
    expect(mockProductFindByIdAndUpdate).toHaveBeenCalledWith("product-1", {
      $inc: { quantity: -2 },
    });
    expect(mockSaleCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        store: "store-1",
        user: "user-1",
        cart: "cart-1",
        totalAmount: 140,
        paymentId: "cash-123",
        items: [
          {
            productId: "product-1",
            nameSnapshot: "Rice Bag",
            categorySnapshot: "Grocery",
            quantity: 2,
            unitPrice: 70,
            lineTotal: 140,
          },
        ],
      })
    );
    expect(cart.status).toBe("completed");
    expect(cart.save).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      sale: createdSale,
      cart,
      inventoryAdjusted: true,
      saleCreated: true,
    });
  });

  test("backfills a completed cart without decrementing inventory again", async () => {
    const updatedAt = new Date("2026-04-09T10:00:00.000Z");
    const cart = buildCart({
      status: "completed",
      updatedAt,
      save: jest.fn().mockResolvedValue(undefined),
    });
    const createdSale = { _id: "sale-2" };

    mockAssertCartAccess.mockResolvedValue(cart);
    mockSaleFindOne.mockResolvedValue(null);
    mockSaleCreate.mockResolvedValue(createdSale);

    const result = await materializeSaleFromCart("cart-1", "user-1");

    expect(mockProductFindByIdAndUpdate).not.toHaveBeenCalled();
    expect(mockSaleCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        completedAt: updatedAt,
      })
    );
    expect(cart.save).not.toHaveBeenCalled();
    expect(result).toEqual({
      sale: createdSale,
      cart,
      inventoryAdjusted: false,
      saleCreated: true,
    });
  });

  test("reuses an existing sale snapshot without duplicate writes or stock changes", async () => {
    const cart = buildCart({
      status: "payment_pending",
    });
    const existingSale = { _id: "sale-existing", cart: "cart-1" };

    mockAssertCartAccess.mockResolvedValue(cart);
    mockSaleFindOne.mockResolvedValue(existingSale);

    const result = await materializeSaleFromCart("cart-1", "user-1");

    expect(mockSaleCreate).not.toHaveBeenCalled();
    expect(mockProductFindByIdAndUpdate).not.toHaveBeenCalled();
    expect(cart.status).toBe("completed");
    expect(cart.save).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      sale: existingSale,
      cart,
      inventoryAdjusted: false,
      saleCreated: false,
    });
  });
});
