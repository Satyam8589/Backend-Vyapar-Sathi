import authRoutes from "../modules/auth/auth.routes.js";
import storeRoutes from "../modules/store/store.routes.js";
import { Router } from "express";

const router = Router();

router.use("/auth", authRoutes);
router.use("/store", storeRoutes);

export default router;

