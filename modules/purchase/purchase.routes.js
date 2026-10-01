import { Router } from 'express';
import authMiddleware from '../../middlewares/auth.middleware.js';
import requireUser from '../../middlewares/requireUser.middleware.js';
import requirePermission from '../../middlewares/requirePermission.middleware.js';
import { PERMISSIONS } from '../../utils/permissions.js';
import {
  createPurchaseController,
  getPurchasesController,
  getPurchaseByIdController,
  updatePurchaseController,
  deletePurchaseController,
} from './purchase.controller.js';

const router = Router({ mergeParams: true });

router.use(authMiddleware);
router.use(requireUser);

// GET  /api/purchases/:storeId
// POST /api/purchases/:storeId
router
  .route('/:storeId')
  .get(requirePermission(PERMISSIONS.INVENTORY_MANAGE), getPurchasesController)
  .post(requirePermission(PERMISSIONS.INVENTORY_MANAGE), createPurchaseController);

// GET    /api/purchases/:storeId/:purchaseId
// PUT    /api/purchases/:storeId/:purchaseId
// DELETE /api/purchases/:storeId/:purchaseId
router
  .route('/:storeId/:purchaseId')
  .get(requirePermission(PERMISSIONS.INVENTORY_MANAGE), getPurchaseByIdController)
  .put(requirePermission(PERMISSIONS.INVENTORY_MANAGE), updatePurchaseController)
  .delete(requirePermission(PERMISSIONS.INVENTORY_MANAGE), deletePurchaseController);

export default router;
