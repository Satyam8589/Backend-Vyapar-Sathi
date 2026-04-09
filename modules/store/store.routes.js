import { Router } from "express";
import { storeCreateController, storeGetController, storeUpdateController, storeDeleteController, storeGetAllController } from "./store.controller.js";
import authMiddleware from "../../middlewares/auth.middleware.js";
import requireUser from "../../middlewares/requireUser.middleware.js";
import roleRoutes from "../role/role.routes.js";
import employeeRoutes from "../employee/employee.routes.js";

const router = Router();

// All store routes require authentication AND user to exist in DB
router.use(authMiddleware);
router.use(requireUser);

router.route("/all").get(storeGetAllController);
router.route("/create").post(storeCreateController);

// Nested routes for roles and employees under a specific store
router.use("/:storeId/roles", roleRoutes);
router.use("/:storeId/employees", employeeRoutes);

router.route("/:storeId").get(storeGetController);
router.route("/:storeId").put(storeUpdateController);
router.route("/:storeId").delete(storeDeleteController);

export default router;
