import express from "express";
import * as controller from "./automation.controller.js";
import authMiddleware from "../../middlewares/auth.middleware.js";
import requireUser from "../../middlewares/requireUser.middleware.js";

const router = express.Router();

// Require authentication for all automation endpoints
router.use(authMiddleware);
router.use(requireUser);

router.post("/", controller.createAutomation);
router.get("/", controller.getAutomations);
router.patch("/:id/status", controller.toggleStatus);
router.delete("/:id", controller.deleteAutomation);
router.post("/:id/trigger-now", controller.triggerNow);

export default router;
