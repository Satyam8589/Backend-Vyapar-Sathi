import { Router } from "express";
import authMiddleware from "../../middlewares/auth.middleware.js";
import requireUser from "../../middlewares/requireUser.middleware.js";
import {
  getForecastController,
  getInsightsController,
  getProductInsightController,
  getRestockController,
} from "./ai.controller.js";

const router = Router();

router.use(authMiddleware);
router.use(requireUser);

router.get("/:storeId/forecast", getForecastController);
router.get("/:storeId/restock", getRestockController);
router.get("/:storeId/insights", getInsightsController);
router.get("/:storeId/product/:productId", getProductInsightController);

export default router;
