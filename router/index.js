import authRoutes from "../modules/auth/auth.routes.js";
import storeRoutes from "../modules/store/store.routes.js";
import productRoutes from "../modules/product/product.routes.js";
import userRoutes from "../modules/user/user.routes.js";
import cartRoutes from "../modules/cart/cart.routes.js";
import { Router } from "express";

const router = Router();

router.use("/auth", authRoutes);
router.use("/user", userRoutes);
router.use("/store", storeRoutes);
router.use("/product", productRoutes);
router.use("/cart", cartRoutes);

export default router;

