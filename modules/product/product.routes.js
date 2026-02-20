import { Router } from "express";
import { addProductController, getProductController, updateProductController, deleteProductController, getAllProductsController, getProductByBarcodeController, resolveProduct } from "./product.controller.js";
import authMiddleware from "../../middlewares/auth.middleware.js";
import requireUser from "../../middlewares/requireUser.middleware.js";

const router = Router();

// ─── Public routes (no auth required) ───────────────────────────────────────
// Resolve a product globally by barcode via external API + DB cache
router.route("/resolve/:barcode").get(resolveProduct);

// ─── Authenticated routes ────────────────────────────────────────────────────
// All routes below require a valid Firebase token AND registered user in DB
router.use(authMiddleware);
router.use(requireUser);

router.route("/all").get(getAllProductsController);

router.route("/barcode/:barcode").get(getProductByBarcodeController);

router.route("/add_product").post(addProductController);

router.route("/:id").get(getProductController);
router.route("/:id").put(updateProductController);
router.route("/:id").delete(deleteProductController);

export default router;