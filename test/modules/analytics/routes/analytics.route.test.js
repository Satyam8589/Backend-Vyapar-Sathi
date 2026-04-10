import { jest } from "@jest/globals";
import express from "express";
import request from "supertest";

const mockAuthMiddleware = jest.fn((req, _res, next) => {
  req.user = { _id: "user-123" };
  next();
});

const mockRequireUser = jest.fn((_req, _res, next) => {
  next();
});

const mockRequirePermissionMiddleware = jest.fn((req, _res, next) => {
  req.permissionChecked = true;
  next();
});

const mockRequirePermissionFactory = jest.fn(() => mockRequirePermissionMiddleware);

const mockGetStoreSummaryController = jest.fn((req, res) => {
  res.status(200).json({
    route: "summary",
    storeId: req.params.storeId,
    permissionChecked: req.permissionChecked,
  });
});

const mockGetStoreTrendController = jest.fn((req, res) => {
  res.status(200).json({ route: "trends", storeId: req.params.storeId });
});

const mockGetStoreCategoryPerformanceController = jest.fn((req, res) => {
  res.status(200).json({ route: "categories", storeId: req.params.storeId });
});

const mockGetTopProductsController = jest.fn((req, res) => {
  res.status(200).json({ route: "products-top", storeId: req.params.storeId });
});

const mockGetSlowMovingProductsController = jest.fn((req, res) => {
  res.status(200).json({ route: "products-slow", storeId: req.params.storeId });
});

const mockGetProductOverviewController = jest.fn((req, res) => {
  res.status(200).json({
    route: "product-overview",
    storeId: req.params.storeId,
    productId: req.params.productId,
  });
});

jest.unstable_mockModule("../../../../middlewares/auth.middleware.js", () => ({
  default: mockAuthMiddleware,
}));

jest.unstable_mockModule("../../../../middlewares/requireUser.middleware.js", () => ({
  default: mockRequireUser,
}));

jest.unstable_mockModule("../../../../middlewares/requirePermission.middleware.js", () => ({
  default: mockRequirePermissionFactory,
}));

jest.unstable_mockModule("../../../../utils/permissions.js", () => ({
  PERMISSIONS: {
    REPORTS_VIEW_SALES: "reports:view_sales",
  },
}));

jest.unstable_mockModule("../../../../modules/analytics/analytics.controller.js", () => ({
  getStoreSummaryController: mockGetStoreSummaryController,
  getStoreTrendController: mockGetStoreTrendController,
  getStoreCategoryPerformanceController: mockGetStoreCategoryPerformanceController,
  getTopProductsController: mockGetTopProductsController,
  getSlowMovingProductsController: mockGetSlowMovingProductsController,
  getProductOverviewController: mockGetProductOverviewController,
}));

const { default: analyticsRouter } = await import(
  "../../../../modules/analytics/analytics.route.js"
);

describe("analytics.routes", () => {
  beforeEach(() => {
    mockAuthMiddleware.mockClear();
    mockRequireUser.mockClear();
    mockRequirePermissionMiddleware.mockClear();
    mockGetStoreSummaryController.mockClear();
    mockGetStoreTrendController.mockClear();
    mockGetStoreCategoryPerformanceController.mockClear();
    mockGetTopProductsController.mockClear();
    mockGetSlowMovingProductsController.mockClear();
    mockGetProductOverviewController.mockClear();
  });

  test("GET /store/:storeId/summary runs auth + requireUser + requirePermission", async () => {
    const app = express();
    app.use(express.json());
    app.use("/analytics", analyticsRouter);

    const response = await request(app).get("/analytics/store/store-1/summary");

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      route: "summary",
      storeId: "store-1",
      permissionChecked: true,
    });

    expect(mockAuthMiddleware).toHaveBeenCalledTimes(1);
    expect(mockRequireUser).toHaveBeenCalledTimes(1);
    expect(mockRequirePermissionMiddleware).toHaveBeenCalledTimes(1);
    expect(mockGetStoreSummaryController).toHaveBeenCalledTimes(1);
  });

  test("GET /store/:storeId/products/top reaches top products controller", async () => {
    const app = express();
    app.use(express.json());
    app.use("/analytics", analyticsRouter);

    const response = await request(app).get("/analytics/store/store-1/products/top");

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      route: "products-top",
      storeId: "store-1",
    });

    expect(mockRequirePermissionMiddleware).toHaveBeenCalledTimes(1);
    expect(mockGetTopProductsController).toHaveBeenCalledTimes(1);
  });

  test("GET /store/:storeId/products/:productId/overview passes both params", async () => {
    const app = express();
    app.use(express.json());
    app.use("/analytics", analyticsRouter);

    const response = await request(app).get(
      "/analytics/store/store-1/products/product-22/overview"
    );

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      route: "product-overview",
      storeId: "store-1",
      productId: "product-22",
    });

    expect(mockRequirePermissionMiddleware).toHaveBeenCalledTimes(1);
    expect(mockGetProductOverviewController).toHaveBeenCalledTimes(1);
  });

  test("invalid route returns 404", async () => {
    const app = express();
    app.use(express.json());
    app.use("/analytics", analyticsRouter);

    const response = await request(app).get("/analytics/unknown/path");

    expect(response.status).toBe(404);
  });
});
