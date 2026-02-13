import { Router } from "express";
import { getUserController } from "./user.controller.js";
import authMiddleware from "../../middlewares/auth.middleware.js";

const router = Router();

router.route("/:id").get(authMiddleware, getUserController);

export default router;