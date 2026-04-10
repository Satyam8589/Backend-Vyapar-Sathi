import authRoutes from "../modules/auth/auth.routes.js";
import storeRoutes from "../modules/store/store.routes.js";
import productRoutes from "../modules/product/product.routes.js";
import userRoutes from "../modules/user/user.routes.js";
import cartRoutes from "../modules/cart/cart.routes.js";
import saleRoutes from "../modules/sale/sale.routes.js";
import aiRoutes from "../modules/ai/ai.routes.js";
import analyticsRoutes from "../modules/analytics/analytics.route.js";
import { Router } from "express";

const router = Router();

router.use("/auth", authRoutes);
router.use("/user", userRoutes);
router.use("/store", storeRoutes);
// /api/product  → store-scoped product management (authenticated)
// /api/products → global barcode resolver (public + authenticated routes)
router.use("/product", productRoutes);
router.use("/products", productRoutes);
router.use("/cart", cartRoutes);
router.use("/sales", saleRoutes);
router.use("/ai", aiRoutes);
router.use("/analytics", analyticsRoutes);

export default router;

