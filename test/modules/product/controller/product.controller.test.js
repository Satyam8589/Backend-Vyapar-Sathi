import { jest } from "@jest/globals";

const mockAddProduct = jest.fn();
const mockGetProductById = jest.fn();
const mockUpdateProductById = jest.fn();
const mockDeleteProductById = jest.fn();
const mockGetAllProducts = jest.fn();
const mockGetProductByBarcode = jest.fn();

jest.unstable_mockModule(
  "../../../../modules/product/product.service.js",
  () => ({
    addProduct: mockAddProduct,
    getProductById: mockGetProductById,
    updateProductById: mockUpdateProductById,
    deleteProductById: mockDeleteProductById,
    getAllProducts: mockGetAllProducts,
    getProductByBarcode: mockGetProductByBarcode,
  }),
);

const {
  addProductController,
  getProductController,
  updateProductController,
  deleteProductController,
  getAllProductsController,
  getProductByBarcodeController,
} = await import("../../../../modules/product/product.controller.js");

describe("product.controller.addProductController", () => {
  beforeEach(() => {
    mockAddProduct.mockReset();
  });

  test("creates product with authenticated user context and returns 201 ApiResponse", async () => {
    const req = {
      body: {
        name: "Test Product",
        category: "Electronics",
        price: 999,
        quantity: 10,
        storeId: "507f1f77bcf86cd799439011",
      },
      user: {
        _id: "507f1f77bcf86cd799439012",
      },
    };

    const createdProduct = {
      _id: "507f1f77bcf86cd799439013",
      name: "Test Product",
      category: "Electronics",
      price: 999,
      quantity: 10,
      store: "507f1f77bcf86cd799439011",
      createdBy: req.user._id,
      isActive: true,
    };

    const status = jest.fn();
    const json = jest.fn();
    status.mockReturnValue({ json });

    const res = { status, json };

    mockAddProduct.mockResolvedValue(createdProduct);

    await addProductController(req, res);

    expect(mockAddProduct).toHaveBeenCalledWith({
      name: "Test Product",
      category: "Electronics",
      price: 999,
      quantity: 10,
      storeId: "507f1f77bcf86cd799439011",
      store: "507f1f77bcf86cd799439011",
      createdBy: "507f1f77bcf86cd799439012",
    });

    expect(status).toHaveBeenCalledWith(201);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        data: createdProduct,
        message: "Product created successfully",
        statusCode: 201,
      }),
    );
  });

  test("handles store field from req.body.store instead of storeId", async () => {
    const req = {
      body: {
        name: "Test Product",
        category: "Electronics",
        price: 999,
        store: "507f1f77bcf86cd799439011",
      },
      user: {
        _id: "507f1f77bcf86cd799439012",
      },
    };

    const createdProduct = {
      _id: "507f1f77bcf86cd799439013",
      ...req.body,
      createdBy: req.user._id,
    };

    const status = jest.fn();
    const json = jest.fn();
    status.mockReturnValue({ json });

    const res = { status, json };

    mockAddProduct.mockResolvedValue(createdProduct);

    await addProductController(req, res);

    expect(mockAddProduct).toHaveBeenCalledWith(
      expect.objectContaining({
        store: "507f1f77bcf86cd799439011",
        createdBy: "507f1f77bcf86cd799439012",
      }),
    );

    expect(status).toHaveBeenCalledWith(201);
  });

  test("handles error when service fails with 409 conflict", async () => {
    const req = {
      body: {
        name: "Duplicate Product",
        category: "Electronics",
        price: 999,
        storeId: "507f1f77bcf86cd799439011",
      },
      user: {
        _id: "507f1f77bcf86cd799439012",
      },
    };

    const status = jest.fn();
    const json = jest.fn();
    status.mockReturnValue({ json });

    const res = { status, json };

    const mockError = new Error("A product with this name already exists");
    mockError.statusCode = 409;
    mockAddProduct.mockRejectedValue(mockError);

    await addProductController(req, res);

    expect(status).toHaveBeenCalledWith(409);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        data: null,
        message: "A product with this name already exists",
        statusCode: 409,
      }),
    );
  });

  test("handles error when service fails with 400 validation error", async () => {
    const req = {
      body: {
        category: "Electronics",
        price: 999,
        storeId: "507f1f77bcf86cd799439011",
      },
      user: {
        _id: "507f1f77bcf86cd799439012",
      },
    };

    const status = jest.fn();
    const json = jest.fn();
    status.mockReturnValue({ json });

    const res = { status, json };

    const mockError = new Error("Name, category, and price are required");
    mockError.statusCode = 400;
    mockAddProduct.mockRejectedValue(mockError);

    await addProductController(req, res);

    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        data: null,
        statusCode: 400,
      }),
    );
  });

  test("handles unknown errors with 500 status code", async () => {
    const req = {
      body: {
        name: "Test Product",
        category: "Electronics",
        price: 999,
        storeId: "507f1f77bcf86cd799439011",
      },
      user: {
        _id: "507f1f77bcf86cd799439012",
      },
    };

    const status = jest.fn();
    const json = jest.fn();
    status.mockReturnValue({ json });

    const res = { status, json };

    const mockError = new Error("Unexpected database error");
    mockAddProduct.mockRejectedValue(mockError);

    await addProductController(req, res);

    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        data: null,
        statusCode: 500,
      }),
    );
  });
});

describe("product.controller.getProductController", () => {
  beforeEach(() => {
    mockGetProductById.mockReset();
  });

  test("successfully retrieves product by ID and returns 200 ApiResponse", async () => {
    const req = {
      params: {
        id: "507f1f77bcf86cd799439013",
      },
    };

    const mockProduct = {
      _id: "507f1f77bcf86cd799439013",
      name: "Test Product",
      category: "Electronics",
      price: 999,
      isActive: true,
    };

    const status = jest.fn();
    const json = jest.fn();
    status.mockReturnValue({ json });

    const res = { status, json };

    mockGetProductById.mockResolvedValue(mockProduct);

    await getProductController(req, res);

    expect(mockGetProductById).toHaveBeenCalledWith("507f1f77bcf86cd799439013");
    expect(status).toHaveBeenCalledWith(200);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        data: mockProduct,
        message: "Product fetched successfully",
        statusCode: 200,
      }),
    );
  });

  test("handles 404 error when product not found", async () => {
    const req = {
      params: {
        id: "507f1f77bcf86cd799439013",
      },
    };

    const status = jest.fn();
    const json = jest.fn();
    status.mockReturnValue({ json });

    const res = { status, json };

    const mockError = new Error("Product not found");
    mockError.statusCode = 404;
    mockGetProductById.mockRejectedValue(mockError);

    await getProductController(req, res);

    expect(status).toHaveBeenCalledWith(404);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        data: null,
        message: "Product not found",
        statusCode: 404,
      }),
    );
  });

  test("handles server errors with 500 status", async () => {
    const req = {
      params: {
        id: "507f1f77bcf86cd799439013",
      },
    };

    const status = jest.fn();
    const json = jest.fn();
    status.mockReturnValue({ json });

    const res = { status, json };

    const mockError = new Error("Database error");
    mockGetProductById.mockRejectedValue(mockError);

    await getProductController(req, res);

    expect(status).toHaveBeenCalledWith(500);
  });
});

describe("product.controller.updateProductController", () => {
  beforeEach(() => {
    mockUpdateProductById.mockReset();
  });

  test("successfully updates product and returns 200 ApiResponse", async () => {
    const req = {
      params: {
        id: "507f1f77bcf86cd799439013",
      },
      body: {
        name: "Updated Product",
        price: 1499,
        quantity: 25,
      },
    };

    const updatedProduct = {
      _id: "507f1f77bcf86cd799439013",
      name: "Updated Product",
      price: 1499,
      quantity: 25,
      isActive: true,
    };

    const status = jest.fn();
    const json = jest.fn();
    status.mockReturnValue({ json });

    const res = { status, json };

    mockUpdateProductById.mockResolvedValue(updatedProduct);

    await updateProductController(req, res);

    expect(mockUpdateProductById).toHaveBeenCalledWith(
      "507f1f77bcf86cd799439013",
      req.body,
    );
    expect(status).toHaveBeenCalledWith(200);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        data: updatedProduct,
        message: "Product updated successfully",
        statusCode: 200,
      }),
    );
  });

  test("handles 404 error when product not found", async () => {
    const req = {
      params: {
        id: "507f1f77bcf86cd799439013",
      },
      body: {
        name: "Updated Product",
      },
    };

    const status = jest.fn();
    const json = jest.fn();
    status.mockReturnValue({ json });

    const res = { status, json };

    const mockError = new Error("Product not found");
    mockError.statusCode = 404;
    mockUpdateProductById.mockRejectedValue(mockError);

    await updateProductController(req, res);

    expect(status).toHaveBeenCalledWith(404);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        data: null,
        message: "Product not found",
        statusCode: 404,
      }),
    );
  });

  test("handles validation errors", async () => {
    const req = {
      params: {
        id: "507f1f77bcf86cd799439013",
      },
      body: {
        price: -100,
      },
    };

    const status = jest.fn();
    const json = jest.fn();
    status.mockReturnValue({ json });

    const res = { status, json };

    const mockError = new Error("Validation failed");
    mockError.statusCode = 400;
    mockUpdateProductById.mockRejectedValue(mockError);

    await updateProductController(req, res);

    expect(status).toHaveBeenCalledWith(400);
  });
});

describe("product.controller.deleteProductController", () => {
  beforeEach(() => {
    mockDeleteProductById.mockReset();
  });

  test("successfully deletes product and returns 200 ApiResponse", async () => {
    const req = {
      params: {
        id: "507f1f77bcf86cd799439013",
      },
    };

    const deletedProduct = {
      _id: "507f1f77bcf86cd799439013",
      name: "Test Product",
      isActive: false,
    };

    const status = jest.fn();
    const json = jest.fn();
    status.mockReturnValue({ json });

    const res = { status, json };

    mockDeleteProductById.mockResolvedValue(deletedProduct);

    await deleteProductController(req, res);

    expect(mockDeleteProductById).toHaveBeenCalledWith(
      "507f1f77bcf86cd799439013",
    );
    expect(status).toHaveBeenCalledWith(200);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        data: deletedProduct,
        message: "Product deleted successfully",
        statusCode: 200,
      }),
    );
  });

  test("handles 404 error when product not found", async () => {
    const req = {
      params: {
        id: "507f1f77bcf86cd799439013",
      },
    };

    const status = jest.fn();
    const json = jest.fn();
    status.mockReturnValue({ json });

    const res = { status, json };

    const mockError = new Error("Product not found");
    mockError.statusCode = 404;
    mockDeleteProductById.mockRejectedValue(mockError);

    await deleteProductController(req, res);

    expect(status).toHaveBeenCalledWith(404);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        data: null,
        message: "Product not found",
        statusCode: 404,
      }),
    );
  });

  test("handles server errors", async () => {
    const req = {
      params: {
        id: "507f1f77bcf86cd799439013",
      },
    };

    const status = jest.fn();
    const json = jest.fn();
    status.mockReturnValue({ json });

    const res = { status, json };

    const mockError = new Error("Database error");
    mockDeleteProductById.mockRejectedValue(mockError);

    await deleteProductController(req, res);

    expect(status).toHaveBeenCalledWith(500);
  });
});

describe("product.controller.getAllProductsController", () => {
  beforeEach(() => {
    mockGetAllProducts.mockReset();
  });

  test("successfully retrieves all products for a store and returns 200 ApiResponse", async () => {
    const req = {
      query: {
        storeId: "507f1f77bcf86cd799439011",
      },
    };

    const mockProducts = [
      {
        _id: "507f1f77bcf86cd799439013",
        name: "Product 1",
        price: 100,
        isActive: true,
      },
      {
        _id: "507f1f77bcf86cd799439014",
        name: "Product 2",
        price: 200,
        isActive: true,
      },
    ];

    const status = jest.fn();
    const json = jest.fn();
    status.mockReturnValue({ json });

    const res = { status, json };

    mockGetAllProducts.mockResolvedValue(mockProducts);

    await getAllProductsController(req, res);

    expect(mockGetAllProducts).toHaveBeenCalledWith("507f1f77bcf86cd799439011");
    expect(status).toHaveBeenCalledWith(200);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        data: mockProducts,
        message: "Products fetched successfully",
        statusCode: 200,
      }),
    );
  });

  test("handles empty product list", async () => {
    const req = {
      query: {
        storeId: "507f1f77bcf86cd799439011",
      },
    };

    const status = jest.fn();
    const json = jest.fn();
    status.mockReturnValue({ json });

    const res = { status, json };

    mockGetAllProducts.mockResolvedValue([]);

    await getAllProductsController(req, res);

    expect(status).toHaveBeenCalledWith(200);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        data: [],
        message: "Products fetched successfully",
        statusCode: 200,
      }),
    );
  });

  test("handles 400 error when storeId is missing", async () => {
    const req = {
      query: {},
    };

    const status = jest.fn();
    const json = jest.fn();
    status.mockReturnValue({ json });

    const res = { status, json };

    const mockError = new Error("Store ID is required to fetch products");
    mockError.statusCode = 400;
    mockGetAllProducts.mockRejectedValue(mockError);

    await getAllProductsController(req, res);

    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        data: null,
        statusCode: 400,
      }),
    );
  });

  test("handles server errors", async () => {
    const req = {
      query: {
        storeId: "507f1f77bcf86cd799439011",
      },
    };

    const status = jest.fn();
    const json = jest.fn();
    status.mockReturnValue({ json });

    const res = { status, json };

    const mockError = new Error("Database error");
    mockGetAllProducts.mockRejectedValue(mockError);

    await getAllProductsController(req, res);

    expect(status).toHaveBeenCalledWith(500);
  });
});

describe("product.controller.getProductByBarcodeController", () => {
  beforeEach(() => {
    mockGetProductByBarcode.mockReset();
  });

  test("successfully retrieves product by barcode and returns 200 ApiResponse", async () => {
    const req = {
      params: {
        barcode: "123456789",
      },
      query: {
        storeId: "507f1f77bcf86cd799439011",
      },
    };

    const mockProduct = {
      _id: "507f1f77bcf86cd799439013",
      name: "Test Product",
      barcode: "123456789",
      price: 999,
      isActive: true,
    };

    const status = jest.fn();
    const json = jest.fn();
    status.mockReturnValue({ json });

    const res = { status, json };

    mockGetProductByBarcode.mockResolvedValue(mockProduct);

    await getProductByBarcodeController(req, res);

    expect(mockGetProductByBarcode).toHaveBeenCalledWith(
      "123456789",
      "507f1f77bcf86cd799439011",
    );
    expect(status).toHaveBeenCalledWith(200);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        data: mockProduct,
        message: "Product found",
        statusCode: 200,
      }),
    );
  });

  test("returns 404 when product with barcode is not found", async () => {
    const req = {
      params: {
        barcode: "nonexistent",
      },
      query: {
        storeId: "507f1f77bcf86cd799439011",
      },
    };

    const status = jest.fn();
    const json = jest.fn();
    status.mockReturnValue({ json });

    const res = { status, json };

    mockGetProductByBarcode.mockResolvedValue(null);

    await getProductByBarcodeController(req, res);

    expect(status).toHaveBeenCalledWith(404);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        data: null,
        message: "Product not found with this barcode",
        statusCode: 404,
      }),
    );
  });

  test("handles 400 error when barcode is missing", async () => {
    const req = {
      params: {},
      query: {
        storeId: "507f1f77bcf86cd799439011",
      },
    };

    const status = jest.fn();
    const json = jest.fn();
    status.mockReturnValue({ json });

    const res = { status, json };

    const mockError = new Error("Barcode is required");
    mockError.statusCode = 400;
    mockGetProductByBarcode.mockRejectedValue(mockError);

    await getProductByBarcodeController(req, res);

    expect(status).toHaveBeenCalledWith(400);
  });

  test("handles 400 error when storeId is missing", async () => {
    const req = {
      params: {
        barcode: "123456789",
      },
      query: {},
    };

    const status = jest.fn();
    const json = jest.fn();
    status.mockReturnValue({ json });

    const res = { status, json };

    const mockError = new Error("Store ID is required for barcode lookup");
    mockError.statusCode = 400;
    mockGetProductByBarcode.mockRejectedValue(mockError);

    await getProductByBarcodeController(req, res);

    expect(status).toHaveBeenCalledWith(400);
  });

  test("handles server errors", async () => {
    const req = {
      params: {
        barcode: "123456789",
      },
      query: {
        storeId: "507f1f77bcf86cd799439011",
      },
    };

    const status = jest.fn();
    const json = jest.fn();
    status.mockReturnValue({ json });

    const res = { status, json };

    const mockError = new Error("Database error");
    mockGetProductByBarcode.mockRejectedValue(mockError);

    await getProductByBarcodeController(req, res);

    expect(status).toHaveBeenCalledWith(500);
  });
});
