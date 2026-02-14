import { Router } from "express";
import { addProductController, getProductController, updateProductController, deleteProductController, getAllProductsController, getProductByBarcodeController } from "./product.controller.js";
import authMiddleware from "../../middlewares/auth.middleware.js";
import requireUser from "../../middlewares/requireUser.middleware.js";

const router = Router();

// All product routes require authentication AND user to exist in DB
router.use(authMiddleware);
router.use(requireUser);

router.route("/all").get(getAllProductsController);

router.route("/barcode/:barcode").get(getProductByBarcodeController);

router.route("/add_product").post(addProductController);

router.route("/:id").get(getProductController);
router.route("/:id").put(updateProductController);
router.route("/:id").delete(deleteProductController);

export default router;