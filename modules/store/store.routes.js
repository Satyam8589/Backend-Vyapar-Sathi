import { Router } from "express";
import { storeCreateController } from "./store.controller.js";
import { storeGetController } from "./store.controller.js";
import { storeUpdateController } from "./store.controller.js";
import { storeDeleteController } from "./store.controller.js";
import authMiddleware from "../../middlewares/auth.middleware.js";


const router = Router();

router.route("/create").post(authMiddleware, storeCreateController);
router.route("/:storeId").get(authMiddleware, storeGetController);
router.route("/:storeId").put(authMiddleware, storeUpdateController);
router.route("/:storeId").delete(authMiddleware, storeDeleteController);

export default router;
