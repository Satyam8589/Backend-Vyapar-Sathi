import { Router } from "express";
import authMiddleware from "../../middlewares/auth.middleware.js";
import requireUser from "../../middlewares/requireUser.middleware.js";
import requirePermission from "../../middlewares/requirePermission.middleware.js";
import { PERMISSIONS } from "../../utils/permissions.js";
import {
	getStoreSummaryController,
	getStoreTrendController,
	getStoreCategoryPerformanceController,
	getTopProductsController,
	getSlowMovingProductsController,
	getProductOverviewController,
} from "./analytics.controller.js";

const router = Router();

router.use(authMiddleware);
router.use(requireUser);

router.get(
	"/store/:storeId/summary",
	requirePermission(PERMISSIONS.REPORTS_VIEW_SALES),
	getStoreSummaryController
);

router.get(
	"/store/:storeId/trends",
	requirePermission(PERMISSIONS.REPORTS_VIEW_SALES),
	getStoreTrendController
);

router.get(
	"/store/:storeId/categories",
	requirePermission(PERMISSIONS.REPORTS_VIEW_SALES),
	getStoreCategoryPerformanceController
);

router.get(
	"/store/:storeId/products/top",
	requirePermission(PERMISSIONS.REPORTS_VIEW_SALES),
	getTopProductsController
);

router.get(
	"/store/:storeId/products/slow-moving",
	requirePermission(PERMISSIONS.REPORTS_VIEW_SALES),
	getSlowMovingProductsController
);

router.get(
	"/store/:storeId/products/:productId/overview",
	requirePermission(PERMISSIONS.REPORTS_VIEW_SALES),
	getProductOverviewController
);

export default router;
