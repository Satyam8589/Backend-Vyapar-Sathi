import { Router } from "express";
import { storeCreateController, storeGetController, storeUpdateController, storeDeleteController, storeGetAllController } from "./store.controller.js";
import authMiddleware from "../../middlewares/auth.middleware.js";

const router = Router();

router.route("/all").get(authMiddleware, storeGetAllController);
router.route("/create").post(authMiddleware, storeCreateController);
router.route("/:storeId").get(authMiddleware, storeGetController);
router.route("/:storeId").put(authMiddleware, storeUpdateController);
router.route("/:storeId").delete(authMiddleware, storeDeleteController);

export default router;
