import { Router } from "express";
import * as roleController from "./role.controller.js";
import authMiddleware from "../../middlewares/auth.middleware.js";
import requireUser from "../../middlewares/requireUser.middleware.js";
import requireOwner from "../../middlewares/requireOwner.middleware.js";

const router = Router({ mergeParams: true }); // Enable merchanting params from parent router (storeId)

// All role routes require authentication and store ownership
router.use(authMiddleware);
router.use(requireUser);
router.use(requireOwner);

router.route("/")
  .get(roleController.getRolesController)
  .post(roleController.createRoleController);

router.route("/seed")
  .post(roleController.seedRolesController);

router.route("/:roleId")
  .put(roleController.updateRoleController)
  .delete(roleController.deleteRoleController);

export default router;
