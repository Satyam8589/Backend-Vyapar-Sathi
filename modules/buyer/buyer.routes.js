import { Router } from 'express';
import authMiddleware from '../../middlewares/auth.middleware.js';
import requireUser from '../../middlewares/requireUser.middleware.js';
import requirePermission from '../../middlewares/requirePermission.middleware.js';
import { PERMISSIONS } from '../../utils/permissions.js';
import {
  createBuyerController,
  getBuyersController,
  getBuyerStatsController,
  getBuyerByIdController,
  getBuyerPurchasesController,
  updateBuyerController,
  deleteBuyerController,
  getSaleByIdController,
  updateSaleTransactionController,
  deleteSaleTransactionController,
} from './buyer.controller.js';

const router = Router({ mergeParams: true });

router.use(authMiddleware);
router.use(requireUser);

// GET  /api/buyers/:storeId/stats
router.get(
  '/:storeId/stats',
  requirePermission(PERMISSIONS.INVENTORY_MANAGE),
  getBuyerStatsController
);

// GET  /api/buyers/:storeId/:buyerId/purchases
router.get(
  '/:storeId/:buyerId/purchases',
  requirePermission(PERMISSIONS.INVENTORY_MANAGE),
  getBuyerPurchasesController
);

// GET, PUT & DELETE /api/buyers/:storeId/sales/:saleId
router
  .route('/:storeId/sales/:saleId')
  .get(requirePermission(PERMISSIONS.INVENTORY_MANAGE), getSaleByIdController)
  .put(requirePermission(PERMISSIONS.INVENTORY_MANAGE), updateSaleTransactionController)
  .delete(requirePermission(PERMISSIONS.INVENTORY_MANAGE), deleteSaleTransactionController);

// GET  /api/buyers/:storeId
// POST /api/buyers/:storeId
router
  .route('/:storeId')
  .get(requirePermission(PERMISSIONS.INVENTORY_MANAGE), getBuyersController)
  .post(requirePermission(PERMISSIONS.INVENTORY_MANAGE), createBuyerController);

// GET    /api/buyers/:storeId/:buyerId
// PUT    /api/buyers/:storeId/:buyerId
// DELETE /api/buyers/:storeId/:buyerId
router
  .route('/:storeId/:buyerId')
  .get(requirePermission(PERMISSIONS.INVENTORY_MANAGE), getBuyerByIdController)
  .put(requirePermission(PERMISSIONS.INVENTORY_MANAGE), updateBuyerController)
  .delete(requirePermission(PERMISSIONS.INVENTORY_MANAGE), deleteBuyerController);

export default router;
