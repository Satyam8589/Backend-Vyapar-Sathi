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

const router = express.Router();

router.post("/create", authMiddleware, createCartController);
router.patch("/:cartId/start-scan", authMiddleware, startScanningController);
router.get("/:cartId/product/:barcode", authMiddleware, getProductByBarcodeController);
router.post("/:cartId/items", authMiddleware, addItemController);
router.post("/:cartId/payment", authMiddleware, processPaymentController);
router.patch("/:cartId/confirm-payment", authMiddleware, confirmPaymentController);

export default router;