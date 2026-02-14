import { Router } from "express";
import { getUserController } from "./user.controller.js";
import authMiddleware from "../../middlewares/auth.middleware.js";
import requireUser from "../../middlewares/requireUser.middleware.js";

const router = Router();

// User routes require authentication AND user to exist in DB
router.use(authMiddleware);
router.use(requireUser);

router.route("/:id").get(getUserController);

export default router;