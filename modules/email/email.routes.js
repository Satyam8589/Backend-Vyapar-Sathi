import express from "express";
import authMiddleware from "../../middlewares/auth.middleware.js";
import { sendEmail, sendTestEmail } from "./email.controller.js";

const router = express.Router();

router.post("/send", authMiddleware, sendEmail);
router.post("/test", authMiddleware, sendTestEmail);

export default router;