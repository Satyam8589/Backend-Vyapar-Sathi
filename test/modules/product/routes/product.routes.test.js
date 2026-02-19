import { jest } from "@jest/globals";
import express from "express";
import request from "supertest";

const mockAddProductController = jest.fn((req, res) => {
  return res.status(201).json({
    message: "Product created successfully",
    data: {
      _id: "507f1f77bcf86cd799439013",
      ...req.body,
      createdBy: req.user._id,
    },
  });
});

const mockGetProductController = jest.fn((req, res) => {
  return res.status(200).json({
    message: "Product fetched successfully",
    data: {
      _id: req.params.id,
      name: "Test Product",
    },
  });
});

const mockUpdateProductController = jest.fn((req, res) => {
  return res.status(200).json({
    message: "Product updated successfully",
    data: {
      _id: req.params.id,
      ...req.body,
    },
  });
});

const mockDeleteProductController = jest.fn((req, res) => {
  return res.status(200).json({
    message: "Product deleted successfully",
    data: {
      _id: req.params.id,
      isActive: false,
    },
  });
});

const mockGetAllProductsController = jest.fn((req, res) => {
  return res.status(200).json({
    message: "Products fetched successfully",
    data: [
      { _id: "1", name: "Product 1" },
      { _id: "2", name: "Product 2" },
    ],
  });
});

const mockGetProductByBarcodeController = jest.fn((req, res) => {
  return res.status(200).json({
    message: "Product found",
    data: {
      barcode: req.params.barcode,
      name: "Scanned Product",
    },
  });
});

const mockAuthMiddleware = jest.fn((req, _res, next) => {
  req.user = { _id: "507f1f77bcf86cd799439012", firebaseUid: "firebase-123" };
  next();
});

const mockRequireUser = jest.fn((_req, _res, next) => {
  next();
});

jest.unstable_mockModule(
  "../../../../modules/product/product.controller.js",
  () => ({
    addProductController: mockAddProductController,
    getProductController: mockGetProductController,
    updateProductController: mockUpdateProductController,
    deleteProductController: mockDeleteProductController,
    getAllProductsController: mockGetAllProductsController,
    getProductByBarcodeController: mockGetProductByBarcodeController,
  }),
);

jest.unstable_mockModule("../../../../middlewares/auth.middleware.js", () => ({
  default: mockAuthMiddleware,
}));

jest.unstable_mockModule(
  "../../../../middlewares/requireUser.middleware.js",
  () => ({
    default: mockRequireUser,
  }),
);

const { default: productRouter } =
  await import("../../../../modules/product/product.routes.js");

describe("product.routes POST /add_product", () => {
  beforeEach(() => {
    mockAddProductController.mockClear();
    mockAuthMiddleware.mockClear();
    mockRequireUser.mockClear();
  });

  test("runs auth + requireUser and reaches create controller", async () => {
    const app = express();
    app.use(express.json());
    app.use("/products", productRouter);

    const payload = {
      name: "New Product",
      category: "Electronics",
      price: 999,
      quantity: 10,
      storeId: "507f1f77bcf86cd799439011",
    };

    const response = await request(app)
      .post("/products/add_product")
      .send(payload);

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      message: "Product created successfully",
    });

    expect(mockAuthMiddleware).toHaveBeenCalledTimes(1);
    expect(mockRequireUser).toHaveBeenCalledTimes(1);
    expect(mockAddProductController).toHaveBeenCalledTimes(1);
  });

  test("handles request with invalid/malformed JSON body", async () => {
    const app = express();
    app.use(express.json());
    app.use("/products", productRouter);

    const response = await request(app)
      .post("/products/add_product")
      .set("Content-Type", "application/json")
      .send("invalid json");

    expect(response.status).toBe(400);
  });

  test("middleware chain is called even with empty body", async () => {
    const app = express();
    app.use(express.json());
    app.use("/products", productRouter);

    const response = await request(app).post("/products/add_product").send({});

    expect(response.status).toBe(201);
    expect(mockAuthMiddleware).toHaveBeenCalledTimes(1);
    expect(mockRequireUser).toHaveBeenCalledTimes(1);
    expect(mockAddProductController).toHaveBeenCalledTimes(1);
  });
});

describe("product.routes GET /all", () => {
  beforeEach(() => {
    mockGetAllProductsController.mockClear();
    mockAuthMiddleware.mockClear();
    mockRequireUser.mockClear();
  });

  test("runs auth + requireUser and reaches getAllProducts controller", async () => {
    const app = express();
    app.use(express.json());
    app.use("/products", productRouter);

    const response = await request(app)
      .get("/products/all")
      .query({ storeId: "507f1f77bcf86cd799439011" });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      message: "Products fetched successfully",
    });

    expect(mockAuthMiddleware).toHaveBeenCalledTimes(1);
    expect(mockRequireUser).toHaveBeenCalledTimes(1);
    expect(mockGetAllProductsController).toHaveBeenCalledTimes(1);
  });

  test("handles query parameters correctly", async () => {
    const app = express();
    app.use(express.json());
    app.use("/products", productRouter);

    const response = await request(app)
      .get("/products/all")
      .query({ storeId: "507f1f77bcf86cd799439011" });

    expect(response.status).toBe(200);
    expect(response.body.data).toBeDefined();
  });

  test("works without query parameters", async () => {
    const app = express();
    app.use(express.json());
    app.use("/products", productRouter);

    const response = await request(app).get("/products/all");

    expect(response.status).toBe(200);
    expect(mockGetAllProductsController).toHaveBeenCalledTimes(1);
  });
});

describe("product.routes GET /barcode/:barcode", () => {
  beforeEach(() => {
    mockGetProductByBarcodeController.mockClear();
    mockAuthMiddleware.mockClear();
    mockRequireUser.mockClear();
  });

  test("runs auth + requireUser and reaches getProductByBarcode controller", async () => {
    const app = express();
    app.use(express.json());
    app.use("/products", productRouter);

    const response = await request(app)
      .get("/products/barcode/123456789")
      .query({ storeId: "507f1f77bcf86cd799439011" });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      message: "Product found",
    });

    expect(mockAuthMiddleware).toHaveBeenCalledTimes(1);
    expect(mockRequireUser).toHaveBeenCalledTimes(1);
    expect(mockGetProductByBarcodeController).toHaveBeenCalledTimes(1);
  });

  test("passes barcode parameter correctly", async () => {
    const app = express();
    app.use(express.json());
    app.use("/products", productRouter);

    const barcode = "987654321";
    const response = await request(app)
      .get(`/products/barcode/${barcode}`)
      .query({ storeId: "507f1f77bcf86cd799439011" });

    expect(response.status).toBe(200);
    expect(response.body.data.barcode).toBe(barcode);
  });

  test("handles special characters in barcode", async () => {
    const app = express();
    app.use(express.json());
    app.use("/products", productRouter);

    const barcode = "ABC-123-XYZ";
    const response = await request(app)
      .get(`/products/barcode/${barcode}`)
      .query({ storeId: "507f1f77bcf86cd799439011" });

    expect(response.status).toBe(200);
    expect(mockGetProductByBarcodeController).toHaveBeenCalledTimes(1);
  });
});

describe("product.routes GET /:id", () => {
  beforeEach(() => {
    mockGetProductController.mockClear();
    mockAuthMiddleware.mockClear();
    mockRequireUser.mockClear();
  });

  test("runs auth + requireUser and reaches getProduct controller", async () => {
    const app = express();
    app.use(express.json());
    app.use("/products", productRouter);

    const productId = "507f1f77bcf86cd799439013";
    const response = await request(app).get(`/products/${productId}`);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      message: "Product fetched successfully",
    });

    expect(mockAuthMiddleware).toHaveBeenCalledTimes(1);
    expect(mockRequireUser).toHaveBeenCalledTimes(1);
    expect(mockGetProductController).toHaveBeenCalledTimes(1);
  });

  test("passes product ID parameter correctly", async () => {
    const app = express();
    app.use(express.json());
    app.use("/products", productRouter);

    const productId = "507f1f77bcf86cd799439013";
    const response = await request(app).get(`/products/${productId}`);

    expect(response.status).toBe(200);
    expect(response.body.data._id).toBe(productId);
  });
});

describe("product.routes PUT /:id", () => {
  beforeEach(() => {
    mockUpdateProductController.mockClear();
    mockAuthMiddleware.mockClear();
    mockRequireUser.mockClear();
  });

  test("runs auth + requireUser and reaches updateProduct controller", async () => {
    const app = express();
    app.use(express.json());
    app.use("/products", productRouter);

    const productId = "507f1f77bcf86cd799439013";
    const updateData = {
      name: "Updated Product",
      price: 1499,
    };

    const response = await request(app)
      .put(`/products/${productId}`)
      .send(updateData);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      message: "Product updated successfully",
    });

    expect(mockAuthMiddleware).toHaveBeenCalledTimes(1);
    expect(mockRequireUser).toHaveBeenCalledTimes(1);
    expect(mockUpdateProductController).toHaveBeenCalledTimes(1);
  });

  test("passes product ID and update data correctly", async () => {
    const app = express();
    app.use(express.json());
    app.use("/products", productRouter);

    const productId = "507f1f77bcf86cd799439013";
    const updateData = {
      name: "Updated Product",
      price: 1499,
      quantity: 30,
    };

    const response = await request(app)
      .put(`/products/${productId}`)
      .send(updateData);

    expect(response.status).toBe(200);
    expect(response.body.data._id).toBe(productId);
    expect(response.body.data).toMatchObject(updateData);
  });

  test("handles update with partial data", async () => {
    const app = express();
    app.use(express.json());
    app.use("/products", productRouter);

    const productId = "507f1f77bcf86cd799439013";
    const updateData = {
      price: 999,
    };

    const response = await request(app)
      .put(`/products/${productId}`)
      .send(updateData);

    expect(response.status).toBe(200);
    expect(mockUpdateProductController).toHaveBeenCalledTimes(1);
  });

  test("handles invalid JSON in update request", async () => {
    const app = express();
    app.use(express.json());
    app.use("/products", productRouter);

    const productId = "507f1f77bcf86cd799439013";

    const response = await request(app)
      .put(`/products/${productId}`)
      .set("Content-Type", "application/json")
      .send("invalid json");

    expect(response.status).toBe(400);
  });
});

describe("product.routes DELETE /:id", () => {
  beforeEach(() => {
    mockDeleteProductController.mockClear();
    mockAuthMiddleware.mockClear();
    mockRequireUser.mockClear();
  });

  test("runs auth + requireUser and reaches deleteProduct controller", async () => {
    const app = express();
    app.use(express.json());
    app.use("/products", productRouter);

    const productId = "507f1f77bcf86cd799439013";
    const response = await request(app).delete(`/products/${productId}`);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      message: "Product deleted successfully",
    });

    expect(mockAuthMiddleware).toHaveBeenCalledTimes(1);
    expect(mockRequireUser).toHaveBeenCalledTimes(1);
    expect(mockDeleteProductController).toHaveBeenCalledTimes(1);
  });

  test("passes product ID parameter correctly", async () => {
    const app = express();
    app.use(express.json());
    app.use("/products", productRouter);

    const productId = "507f1f77bcf86cd799439013";
    const response = await request(app).delete(`/products/${productId}`);

    expect(response.status).toBe(200);
    expect(response.body.data._id).toBe(productId);
    expect(response.body.data.isActive).toBe(false);
  });
});

describe("product.routes middleware protection", () => {
  beforeEach(() => {
    mockAuthMiddleware.mockClear();
    mockRequireUser.mockClear();
  });

  test("all routes require authentication middleware", async () => {
    const app = express();
    app.use(express.json());
    app.use("/products", productRouter);

    const routes = [
      { method: "post", path: "/products/add_product" },
      { method: "get", path: "/products/all" },
      { method: "get", path: "/products/barcode/123" },
      { method: "get", path: "/products/507f1f77bcf86cd799439013" },
      { method: "put", path: "/products/507f1f77bcf86cd799439013" },
      { method: "delete", path: "/products/507f1f77bcf86cd799439013" },
    ];

    for (const route of routes) {
      mockAuthMiddleware.mockClear();
      mockRequireUser.mockClear();

      if (route.method === "post") {
        await request(app)[route.method](route.path).send({});
      } else {
        await request(app)[route.method](route.path);
      }

      expect(mockAuthMiddleware).toHaveBeenCalled();
      expect(mockRequireUser).toHaveBeenCalled();
    }
  });
});
