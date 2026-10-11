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
  getSellerPurchasesController,
  getSellerPurchaseSummaryController,
  getSellerPaymentsController,
  getSellersPerformanceController,
  getSellerPerformanceByIdController
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

// GET  /api/sellers/:storeId/performance
router.get(
  '/:storeId/performance',
  requirePermission(PERMISSIONS.INVENTORY_MANAGE),
  getSellersPerformanceController
);

// GET  /api/sellers/:storeId/:sellerId/performance
router.get(
  '/:storeId/:sellerId/performance',
  requirePermission(PERMISSIONS.INVENTORY_MANAGE),
  getSellerPerformanceByIdController
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

// GET /api/sellers/:storeId/:sellerId/purchases
router.get(
  '/:storeId/:sellerId/purchases',
  requirePermission(PERMISSIONS.INVENTORY_MANAGE),
  getSellerPurchasesController
);

// GET /api/sellers/:storeId/:sellerId/purchase-summary
router.get(
  '/:storeId/:sellerId/purchase-summary',
  requirePermission(PERMISSIONS.INVENTORY_MANAGE),
  getSellerPurchaseSummaryController
);

// GET /api/sellers/:storeId/:sellerId/payments
router.get(
  '/:storeId/:sellerId/payments',
  requirePermission(PERMISSIONS.INVENTORY_MANAGE),
  getSellerPaymentsController
);

export default router;
