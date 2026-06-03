import { Router } from "express";
import { addProductController, getProductController, updateProductController, deleteProductController, getAllProductsController, getProductByBarcodeController, resolveProduct, uploadProductImageController, getMasterProductController, saveMasterProductController } from "./product.controller.js";
import authMiddleware from "../../middlewares/auth.middleware.js";
import requireUser from "../../middlewares/requireUser.middleware.js";
import { uploadSingleProductImage } from "./product.upload.middleware.js";
import { ApiResponse } from "../../utils/ApiResponse.js";

const router = Router();

const handleProductImageUpload = (req, res, next) => {
	uploadSingleProductImage(req, res, (error) => {
		if (error) {
			return res.status(400).json(new ApiResponse(null, error.message, 400));
		}

		return next();
	});
};

// ─── Public routes (no auth required) ───────────────────────────────────────
// Resolve a product globally by barcode via external API + DB cache
router.route("/resolve/:barcode").get(resolveProduct);

// ─── Authenticated routes ────────────────────────────────────────────────────
// All routes below require a valid Firebase token AND registered user in DB
router.use(authMiddleware);
router.use(requireUser);

router.route("/upload-image").post(handleProductImageUpload, uploadProductImageController);

router.route("/all").get(getAllProductsController);

router.route("/barcode/:barcode").get(getProductByBarcodeController);

router.route("/add_product").post(addProductController);

// ─── Master Product catalog (authenticated) ─────────────────────────────────
// Lookup a barcode in the shared catalog without calling external APIs
router.route("/master/:barcode").get(getMasterProductController);
// Save a manually-entered product to the shared catalog (idempotent)
router.route("/master").post(saveMasterProductController);

router.route("/:id").get(getProductController);
router.route("/:id").put(updateProductController);
router.route("/:id").delete(deleteProductController);

export default router;