import { Router } from "express";
import { verifyInviteToken, acceptInvite, declineInvite } from "./invite.controller.js";
import { requireUser } from "../../middlewares/requireUser.middleware.js";

const router = Router();

// Public route — anyone with the link can preview the invite
router.get("/:token", verifyInviteToken);

// Protected routes — user must be logged in to accept/decline
router.post("/:token/accept", requireUser, acceptInvite);
router.post("/:token/decline", requireUser, declineInvite);

export default router;
