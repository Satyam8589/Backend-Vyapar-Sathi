import { Router } from "express";
import { serverCheck } from "./user.controller.js";

const router = Router();

router.get("/", serverCheck);

export default router;