import express from 'express';
import { register, login, getUserProfile } from './auth.controller.js';
import authMiddleware from '../../middlewares/auth.middleware.js';

const router = express.Router();

router.route("/register").post(authMiddleware, register);
router.route("/login").post(authMiddleware, login);
router.route("/profile").get(authMiddleware, getUserProfile);

export default router;
