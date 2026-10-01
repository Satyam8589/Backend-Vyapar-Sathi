import { Router } from 'express';
import authMiddleware from '../../middlewares/auth.middleware.js';
import requireUser from '../../middlewares/requireUser.middleware.js';
import requirePermission from '../../middlewares/requirePermission.middleware.js';
import { PERMISSIONS } from '../../utils/permissions.js';
import {
  createSellerController,
  getSellersController,
  getSellerStatsController,
  getSellerByIdController,
  updateSellerController,
  deleteSellerController,
} from './seller.controller.js';

const router = Router({ mergeParams: true });

router.use(authMiddleware);
router.use(requireUser);

// GET  /api/sellers/:storeId/stats
router.get(
  '/:storeId/stats',
  requirePermission(PERMISSIONS.INVENTORY_MANAGE),
  getSellerStatsController
);

// GET  /api/sellers/:storeId
// POST /api/sellers/:storeId
router
  .route('/:storeId')
  .get(requirePermission(PERMISSIONS.INVENTORY_MANAGE), getSellersController)
  .post(requirePermission(PERMISSIONS.INVENTORY_MANAGE), createSellerController);

// GET    /api/sellers/:storeId/:sellerId
// PUT    /api/sellers/:storeId/:sellerId
// DELETE /api/sellers/:storeId/:sellerId
router
  .route('/:storeId/:sellerId')
  .get(requirePermission(PERMISSIONS.INVENTORY_MANAGE), getSellerByIdController)
  .put(requirePermission(PERMISSIONS.INVENTORY_MANAGE), updateSellerController)
  .delete(requirePermission(PERMISSIONS.INVENTORY_MANAGE), deleteSellerController);

export default router;
