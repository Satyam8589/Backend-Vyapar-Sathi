import { Router } from "express";
import { addProductController, getProductController, updateProductController, deleteProductController, getAllProductsController, getProductByBarcodeController } from "./product.controller.js";
import authMiddleware from "../../middlewares/auth.middleware.js";

const router = Router();

router.route("/all").get(authMiddleware, getAllProductsController);

router.route("/barcode/:barcode").get(authMiddleware, getProductByBarcodeController);

router.route("/add_product").post(authMiddleware, addProductController);

router.route("/:id").get(authMiddleware, getProductController);
router.route("/:id").put(authMiddleware, updateProductController);
router.route("/:id").delete(authMiddleware, deleteProductController);

export default router;