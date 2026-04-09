import express from "express";
import { 
    createCartController, 
    startScanningController, 
    addItemController, 
    processPaymentController, 
    confirmPaymentController,
    getProductByBarcodeController
} from "./cart.controller.js";
import authMiddleware from "../../middlewares/auth.middleware.js";
import requireUser from "../../middlewares/requireUser.middleware.js";

const router = express.Router();

router.use(authMiddleware);
router.use(requireUser);

router.post("/create", createCartController);
router.patch("/:cartId/start-scan", startScanningController);
router.get("/:cartId/product/:barcode", getProductByBarcodeController);
router.post("/:cartId/items", addItemController);
router.post("/:cartId/payment", processPaymentController);
router.patch("/:cartId/confirm-payment", confirmPaymentController);

export default router;
