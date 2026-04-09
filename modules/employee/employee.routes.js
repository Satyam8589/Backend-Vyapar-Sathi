import { Router } from "express";
import * as employeeController from "./employee.controller.js";
import authMiddleware from "../../middlewares/auth.middleware.js";
import requireUser from "../../middlewares/requireUser.middleware.js";
import requireOwner from "../../middlewares/requireOwner.middleware.js";

const router = Router({ mergeParams: true });

router.use(authMiddleware);
router.use(requireUser);

// Routes that any authenticated employee can access
router.post("/accept/:employeeId", employeeController.acceptInviteController);

// Administrative routes - Require Store Ownership
router.use(requireOwner);

router.route("/")
  .get(employeeController.getEmployeesController)
  .post(employeeController.inviteEmployeeController);

router.route("/:employeeId")
  .put(employeeController.updateEmployeeController)
  .delete(employeeController.removeEmployeeController);

export default router;
