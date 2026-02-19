import { jest } from "@jest/globals";

const mockFindOne = jest.fn();
const mockCreate = jest.fn();
const mockFindById = jest.fn();
const mockFind = jest.fn();

jest.unstable_mockModule("../../../../models", () => ({
  Product: {
    findOne: mockFindOne,
    create: mockCreate,
    findById: mockFindById,
    find: mockFind,
  },
}));

const {
  addProduct,
  getProductById,
  updateProductById,
  deleteProductById,
  getAllProducts,
  getProductByBarcode,
} = await import("../../../../modules/product/product.service.js");
const { ApiError } = await import("../../../../utils/ApiError.js");

describe("product.service.addProduct", () => {
  beforeEach(() => {
    mockFindOne.mockReset();
    mockCreate.mockReset();
  });

  test("successfully creates a product with valid data", async () => {
    const productData = {
      name: "Test Product",
      category: "Electronics",
      price: 999,
      quantity: 10,
      store: "507f1f77bcf86cd799439011",
      createdBy: "507f1f77bcf86cd799439012",
    };

    const createdProduct = {
      _id: "507f1f77bcf86cd799439013",
      ...productData,
      isActive: true,
    };

    mockFindOne.mockResolvedValue(null);
    mockCreate.mockResolvedValue(createdProduct);

    const result = await addProduct(productData);

    expect(result).toEqual(createdProduct);
    expect(mockFindOne).toHaveBeenCalled();
    expect(mockCreate).toHaveBeenCalledWith(productData);
  });

  test("throws 400 when name is missing", async () => {
    const productData = {
      category: "Electronics",
      price: 999,
      store: "507f1f77bcf86cd799439011",
      createdBy: "507f1f77bcf86cd799439012",
    };

    let caughtError;
    try {
      await addProduct(productData);
    } catch (error) {
      caughtError = error;
    }

    expect(caughtError).toBeInstanceOf(ApiError);
    expect(caughtError).toMatchObject({
      message: "Name, category, and price are required",
      statusCode: 400,
    });
    expect(mockCreate).not.toHaveBeenCalled();
  });

  test("throws 400 when category is missing", async () => {
    const productData = {
      name: "Test Product",
      price: 999,
      store: "507f1f77bcf86cd799439011",
      createdBy: "507f1f77bcf86cd799439012",
    };

    let caughtError;
    try {
      await addProduct(productData);
    } catch (error) {
      caughtError = error;
    }

    expect(caughtError).toBeInstanceOf(ApiError);
    expect(caughtError).toMatchObject({
      message: "Name, category, and price are required",
      statusCode: 400,
    });
  });

  test("throws 400 when price is missing", async () => {
    const productData = {
      name: "Test Product",
      category: "Electronics",
      store: "507f1f77bcf86cd799439011",
      createdBy: "507f1f77bcf86cd799439012",
    };

    let caughtError;
    try {
      await addProduct(productData);
    } catch (error) {
      caughtError = error;
    }

    expect(caughtError).toBeInstanceOf(ApiError);
    expect(caughtError).toMatchObject({
      message: "Name, category, and price are required",
      statusCode: 400,
    });
  });

  test("throws 400 when store reference is missing", async () => {
    const productData = {
      name: "Test Product",
      category: "Electronics",
      price: 999,
      createdBy: "507f1f77bcf86cd799439012",
    };

    let caughtError;
    try {
      await addProduct(productData);
    } catch (error) {
      caughtError = error;
    }

    expect(caughtError).toBeInstanceOf(ApiError);
    expect(caughtError).toMatchObject({
      message: "Store reference is required",
      statusCode: 400,
    });
  });

  test("throws 400 when createdBy reference is missing", async () => {
    const productData = {
      name: "Test Product",
      category: "Electronics",
      price: 999,
      store: "507f1f77bcf86cd799439011",
    };

    let caughtError;
    try {
      await addProduct(productData);
    } catch (error) {
      caughtError = error;
    }

    expect(caughtError).toBeInstanceOf(ApiError);
    expect(caughtError).toMatchObject({
      message: "CreatedBy (user) reference is required",
      statusCode: 400,
    });
  });

  test("throws 409 when product with same name already exists in store", async () => {
    const productData = {
      name: "Duplicate Product",
      category: "Electronics",
      price: 999,
      store: "507f1f77bcf86cd799439011",
      createdBy: "507f1f77bcf86cd799439012",
    };

    const existingProduct = {
      _id: "507f1f77bcf86cd799439013",
      name: "Duplicate Product",
      store: "507f1f77bcf86cd799439011",
    };

    mockFindOne.mockResolvedValueOnce(existingProduct);

    let caughtError;
    try {
      await addProduct(productData);
    } catch (error) {
      caughtError = error;
    }

    expect(caughtError).toBeInstanceOf(ApiError);
    expect(caughtError.statusCode).toBe(409);
    expect(caughtError.message).toContain("already exists");
    expect(mockCreate).not.toHaveBeenCalled();
  });

  test("throws 409 when product with same barcode already exists in store", async () => {
    const productData = {
      name: "New Product",
      category: "Electronics",
      price: 999,
      barcode: "123456789",
      store: "507f1f77bcf86cd799439011",
      createdBy: "507f1f77bcf86cd799439012",
    };

    const existingProduct = {
      _id: "507f1f77bcf86cd799439013",
      name: "Existing Product",
      barcode: "123456789",
      store: "507f1f77bcf86cd799439011",
    };

    mockFindOne.mockResolvedValueOnce(null); // Name check passes
    mockFindOne.mockResolvedValueOnce(existingProduct); // Barcode check fails

    let caughtError;
    try {
      await addProduct(productData);
    } catch (error) {
      caughtError = error;
    }

    expect(caughtError).toBeInstanceOf(ApiError);
    expect(caughtError.statusCode).toBe(409);
    expect(caughtError.message).toContain("barcode");
    expect(mockCreate).not.toHaveBeenCalled();
  });

  test("allows product creation with empty barcode", async () => {
    const productData = {
      name: "Product Without Barcode",
      category: "Electronics",
      price: 999,
      barcode: "",
      store: "507f1f77bcf86cd799439011",
      createdBy: "507f1f77bcf86cd799439012",
    };

    const createdProduct = {
      _id: "507f1f77bcf86cd799439013",
      ...productData,
      isActive: true,
    };

    mockFindOne.mockResolvedValue(null);
    mockCreate.mockResolvedValue(createdProduct);

    const result = await addProduct(productData);

    expect(result).toEqual(createdProduct);
    expect(mockCreate).toHaveBeenCalled();
  });

  test("successfully creates product with all optional fields", async () => {
    const productData = {
      name: "Complete Product",
      category: "Electronics",
      price: 1999,
      quantity: 50,
      unit: "Boxes",
      barcode: "987654321",
      expDate: new Date("2025-12-31"),
      store: "507f1f77bcf86cd799439011",
      createdBy: "507f1f77bcf86cd799439012",
    };

    const createdProduct = {
      _id: "507f1f77bcf86cd799439013",
      ...productData,
      isActive: true,
    };

    mockFindOne.mockResolvedValue(null);
    mockCreate.mockResolvedValue(createdProduct);

    const result = await addProduct(productData);

    expect(result).toEqual(createdProduct);
    expect(mockCreate).toHaveBeenCalledWith(productData);
  });
});

describe("product.service.getProductById", () => {
  beforeEach(() => {
    mockFindById.mockReset();
  });

  test("successfully retrieves a product by ID", async () => {
    const productId = "507f1f77bcf86cd799439013";
    const mockProduct = {
      _id: productId,
      name: "Test Product",
      category: "Electronics",
      price: 999,
      isActive: true,
    };

    mockFindById.mockResolvedValue(mockProduct);

    const result = await getProductById(productId);

    expect(result).toEqual(mockProduct);
    expect(mockFindById).toHaveBeenCalledWith(productId);
  });

  test("throws 404 when product is not found", async () => {
    const productId = "507f1f77bcf86cd799439013";

    mockFindById.mockResolvedValue(null);

    let caughtError;
    try {
      await getProductById(productId);
    } catch (error) {
      caughtError = error;
    }

    expect(caughtError).toBeInstanceOf(ApiError);
    expect(caughtError).toMatchObject({
      message: "Product not found",
      statusCode: 404,
    });
  });

  test("propagates database errors", async () => {
    const productId = "507f1f77bcf86cd799439013";
    const dbError = new Error("Database connection failed");

    mockFindById.mockRejectedValue(dbError);

    let caughtError;
    try {
      await getProductById(productId);
    } catch (error) {
      caughtError = error;
    }

    expect(caughtError).toBe(dbError);
  });
});

describe("product.service.updateProductById", () => {
  beforeEach(() => {
    mockFindById.mockReset();
  });

  test("successfully updates a product with valid data", async () => {
    const productId = "507f1f77bcf86cd799439013";
    const updateData = {
      name: "Updated Product",
      price: 1499,
      quantity: 25,
    };

    const mockProduct = {
      _id: productId,
      name: "Test Product",
      price: 999,
      quantity: 10,
      set: jest.fn(),
      save: jest.fn(),
    };

    const updatedProduct = {
      _id: productId,
      ...updateData,
    };

    mockFindById.mockResolvedValue(mockProduct);
    mockProduct.save.mockResolvedValue(updatedProduct);

    const result = await updateProductById(productId, updateData);

    expect(mockFindById).toHaveBeenCalledWith(productId);
    expect(mockProduct.set).toHaveBeenCalledWith(updateData);
    expect(mockProduct.save).toHaveBeenCalled();
  });

  test("throws 404 when trying to update non-existent product", async () => {
    const productId = "507f1f77bcf86cd799439013";
    const updateData = {
      name: "Updated Product",
    };

    mockFindById.mockResolvedValue(null);

    let caughtError;
    try {
      await updateProductById(productId, updateData);
    } catch (error) {
      caughtError = error;
    }

    expect(caughtError).toBeInstanceOf(ApiError);
    expect(caughtError).toMatchObject({
      message: "Product not found",
      statusCode: 404,
    });
  });

  test("updates multiple fields at once", async () => {
    const productId = "507f1f77bcf86cd799439013";
    const updateData = {
      name: "New Name",
      price: 2999,
      quantity: 100,
      category: "New Category",
      barcode: "111222333",
    };

    const mockProduct = {
      _id: productId,
      set: jest.fn(),
      save: jest.fn(),
    };

    mockFindById.mockResolvedValue(mockProduct);
    mockProduct.save.mockResolvedValue({ ...mockProduct, ...updateData });

    await updateProductById(productId, updateData);

    expect(mockProduct.set).toHaveBeenCalledWith(updateData);
    expect(mockProduct.save).toHaveBeenCalled();
  });

  test("propagates validation errors from save", async () => {
    const productId = "507f1f77bcf86cd799439013";
    const updateData = {
      price: -100, // Invalid negative price
    };

    const mockProduct = {
      _id: productId,
      set: jest.fn(),
      save: jest.fn(),
    };

    const validationError = new Error("Validation failed");
    validationError.name = "ValidationError";

    mockFindById.mockResolvedValue(mockProduct);
    mockProduct.save.mockRejectedValue(validationError);

    let caughtError;
    try {
      await updateProductById(productId, updateData);
    } catch (error) {
      caughtError = error;
    }

    expect(caughtError).toBe(validationError);
  });
});

describe("product.service.deleteProductById", () => {
  beforeEach(() => {
    mockFindById.mockReset();
  });

  test("successfully soft deletes a product by setting isActive to false", async () => {
    const productId = "507f1f77bcf86cd799439013";

    const mockProduct = {
      _id: productId,
      name: "Test Product",
      isActive: true,
      save: jest.fn(),
    };

    const deletedProduct = {
      ...mockProduct,
      isActive: false,
    };

    mockFindById.mockResolvedValue(mockProduct);
    mockProduct.save.mockResolvedValue(deletedProduct);

    const result = await deleteProductById(productId);

    expect(mockFindById).toHaveBeenCalledWith(productId);
    expect(mockProduct.isActive).toBe(false);
    expect(mockProduct.save).toHaveBeenCalled();
    expect(result).toBe(mockProduct);
  });

  test("throws 404 when trying to delete non-existent product", async () => {
    const productId = "507f1f77bcf86cd799439013";

    mockFindById.mockResolvedValue(null);

    let caughtError;
    try {
      await deleteProductById(productId);
    } catch (error) {
      caughtError = error;
    }

    expect(caughtError).toBeInstanceOf(ApiError);
    expect(caughtError).toMatchObject({
      message: "Product not found",
      statusCode: 404,
    });
  });

  test("can delete already inactive product", async () => {
    const productId = "507f1f77bcf86cd799439013";

    const mockProduct = {
      _id: productId,
      isActive: false,
      save: jest.fn(),
    };

    mockFindById.mockResolvedValue(mockProduct);
    mockProduct.save.mockResolvedValue(mockProduct);

    const result = await deleteProductById(productId);

    expect(mockProduct.isActive).toBe(false);
    expect(mockProduct.save).toHaveBeenCalled();
  });

  test("propagates database errors during save", async () => {
    const productId = "507f1f77bcf86cd799439013";

    const mockProduct = {
      _id: productId,
      isActive: true,
      save: jest.fn(),
    };

    const dbError = new Error("Database error");
    mockFindById.mockResolvedValue(mockProduct);
    mockProduct.save.mockRejectedValue(dbError);

    let caughtError;
    try {
      await deleteProductById(productId);
    } catch (error) {
      caughtError = error;
    }

    expect(caughtError).toBe(dbError);
  });
});

describe("product.service.getAllProducts", () => {
  beforeEach(() => {
    mockFind.mockReset();
  });

  test("successfully retrieves all active products for a store", async () => {
    const storeId = "507f1f77bcf86cd799439011";

    const mockProducts = [
      {
        _id: "507f1f77bcf86cd799439013",
        name: "Product 1",
        price: 100,
        isActive: true,
        store: storeId,
      },
      {
        _id: "507f1f77bcf86cd799439014",
        name: "Product 2",
        price: 200,
        isActive: true,
        store: storeId,
      },
    ];

    const mockPopulate = jest.fn().mockReturnThis();
    mockFind.mockReturnValue({
      populate: mockPopulate.mockReturnValue({
        populate: jest.fn().mockResolvedValue(mockProducts),
      }),
    });

    const result = await getAllProducts(storeId);

    expect(result).toEqual(mockProducts);
    expect(mockFind).toHaveBeenCalledWith({
      store: storeId,
      isActive: true,
    });
  });

  test("throws 400 when storeId is not provided", async () => {
    let caughtError;
    try {
      await getAllProducts();
    } catch (error) {
      caughtError = error;
    }

    expect(caughtError).toBeInstanceOf(ApiError);
    expect(caughtError).toMatchObject({
      message: "Store ID is required to fetch products",
      statusCode: 400,
    });
    expect(mockFind).not.toHaveBeenCalled();
  });

  test("returns empty array when store has no active products", async () => {
    const storeId = "507f1f77bcf86cd799439011";

    const mockPopulate = jest.fn().mockReturnThis();
    mockFind.mockReturnValue({
      populate: mockPopulate.mockReturnValue({
        populate: jest.fn().mockResolvedValue([]),
      }),
    });

    const result = await getAllProducts(storeId);

    expect(result).toEqual([]);
    expect(result).toHaveLength(0);
  });

  test("populates store and createdBy fields", async () => {
    const storeId = "507f1f77bcf86cd799439011";

    const mockProducts = [
      {
        _id: "507f1f77bcf86cd799439013",
        name: "Product 1",
        store: { _id: storeId, name: "Test Store" },
        createdBy: { _id: "user123", name: "John Doe", email: "john@test.com" },
      },
    ];

    const mockPopulateStore = jest.fn().mockReturnThis();
    const mockPopulateCreatedBy = jest.fn().mockResolvedValue(mockProducts);

    mockFind.mockReturnValue({
      populate: mockPopulateStore.mockReturnValue({
        populate: mockPopulateCreatedBy,
      }),
    });

    const result = await getAllProducts(storeId);

    expect(mockPopulateStore).toHaveBeenCalledWith("store", "name");
    expect(mockPopulateCreatedBy).toHaveBeenCalledWith(
      "createdBy",
      "name email",
    );
    expect(result[0].store).toBeDefined();
    expect(result[0].createdBy).toBeDefined();
  });

  test("propagates database errors", async () => {
    const storeId = "507f1f77bcf86cd799439011";
    const dbError = new Error("Database connection failed");

    mockFind.mockReturnValue({
      populate: jest.fn().mockReturnValue({
        populate: jest.fn().mockRejectedValue(dbError),
      }),
    });

    let caughtError;
    try {
      await getAllProducts(storeId);
    } catch (error) {
      caughtError = error;
    }

    expect(caughtError).toBe(dbError);
  });
});

describe("product.service.getProductByBarcode", () => {
  beforeEach(() => {
    mockFindOne.mockReset();
  });

  test("successfully retrieves a product by barcode and storeId", async () => {
    const barcode = "123456789";
    const storeId = "507f1f77bcf86cd799439011";

    const mockProduct = {
      _id: "507f1f77bcf86cd799439013",
      name: "Test Product",
      barcode: barcode,
      store: { _id: storeId, name: "Test Store" },
      isActive: true,
    };

    const mockPopulate = jest.fn().mockResolvedValue(mockProduct);
    mockFindOne.mockReturnValue({
      populate: mockPopulate,
    });

    const result = await getProductByBarcode(barcode, storeId);

    expect(result).toEqual(mockProduct);
    expect(mockFindOne).toHaveBeenCalledWith({
      barcode,
      store: storeId,
      isActive: true,
    });
    expect(mockPopulate).toHaveBeenCalledWith("store", "name");
  });

  test("throws 400 when barcode is not provided", async () => {
    const storeId = "507f1f77bcf86cd799439011";

    let caughtError;
    try {
      await getProductByBarcode(null, storeId);
    } catch (error) {
      caughtError = error;
    }

    expect(caughtError).toBeInstanceOf(ApiError);
    expect(caughtError).toMatchObject({
      message: "Barcode is required",
      statusCode: 400,
    });
    expect(mockFindOne).not.toHaveBeenCalled();
  });

  test("throws 400 when storeId is not provided", async () => {
    const barcode = "123456789";

    let caughtError;
    try {
      await getProductByBarcode(barcode, null);
    } catch (error) {
      caughtError = error;
    }

    expect(caughtError).toBeInstanceOf(ApiError);
    expect(caughtError).toMatchObject({
      message: "Store ID is required for barcode lookup",
      statusCode: 400,
    });
    expect(mockFindOne).not.toHaveBeenCalled();
  });

  test("returns null when product with barcode is not found", async () => {
    const barcode = "nonexistent";
    const storeId = "507f1f77bcf86cd799439011";

    const mockPopulate = jest.fn().mockResolvedValue(null);
    mockFindOne.mockReturnValue({
      populate: mockPopulate,
    });

    const result = await getProductByBarcode(barcode, storeId);

    expect(result).toBeNull();
  });

  test("only returns active products", async () => {
    const barcode = "123456789";
    const storeId = "507f1f77bcf86cd799439011";

    const mockPopulate = jest.fn().mockResolvedValue(null);
    mockFindOne.mockReturnValue({
      populate: mockPopulate,
    });

    await getProductByBarcode(barcode, storeId);

    expect(mockFindOne).toHaveBeenCalledWith(
      expect.objectContaining({
        isActive: true,
      }),
    );
  });

  test("propagates database errors", async () => {
    const barcode = "123456789";
    const storeId = "507f1f77bcf86cd799439011";
    const dbError = new Error("Database error");

    mockFindOne.mockReturnValue({
      populate: jest.fn().mockRejectedValue(dbError),
    });

    let caughtError;
    try {
      await getProductByBarcode(barcode, storeId);
    } catch (error) {
      caughtError = error;
    }

    expect(caughtError).toBe(dbError);
  });
});
