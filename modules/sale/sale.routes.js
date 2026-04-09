import { Router } from "express";
import authMiddleware from "../../middlewares/auth.middleware.js";
import requireUser from "../../middlewares/requireUser.middleware.js";
import { createSaleFromCartController } from "./sale.controller.js";

const router = Router();

router.use(authMiddleware);
router.use(requireUser);

router.post("/from-cart/:cartId", createSaleFromCartController);

export default router;
