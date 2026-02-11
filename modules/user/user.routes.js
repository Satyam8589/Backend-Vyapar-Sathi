import { Router } from "express";
import { serverCheck } from "./user.controller.js";

const router = Router();

router.route("/").get(serverCheck);

export default router;