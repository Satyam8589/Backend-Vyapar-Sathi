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
  returnPurchaseController,
  getPurchaseReturnsController,
  getPurchaseAnalyticsController,
  getPurchaseReportsController,
  recordPurchasePaymentController,
  getPurchasePaymentsController,
  getReorderSuggestionsController
} from './purchase.controller.js';

const router = Router({ mergeParams: true });

router.use(authMiddleware);
router.use(requireUser);

// GET  /api/purchases/:storeId/analytics
router
  .route('/:storeId/analytics')
  .get(requirePermission(PERMISSIONS.INVENTORY_MANAGE), getPurchaseAnalyticsController);

// GET  /api/purchases/:storeId/reorder-suggestions
router
  .route('/:storeId/reorder-suggestions')
  .get(requirePermission(PERMISSIONS.INVENTORY_MANAGE), getReorderSuggestionsController);

// GET  /api/purchases/:storeId/reports
router
  .route('/:storeId/reports')
  .get(requirePermission(PERMISSIONS.INVENTORY_MANAGE), getPurchaseReportsController);

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

// POST   /api/purchases/:storeId/:purchaseId/returns
// GET    /api/purchases/:storeId/:purchaseId/returns
router
  .route('/:storeId/:purchaseId/returns')
  .post(requirePermission(PERMISSIONS.INVENTORY_MANAGE), returnPurchaseController)
  .get(requirePermission(PERMISSIONS.INVENTORY_MANAGE), getPurchaseReturnsController);

// POST   /api/purchases/:storeId/:purchaseId/payments
// GET    /api/purchases/:storeId/:purchaseId/payments
router
  .route('/:storeId/:purchaseId/payments')
  .post(requirePermission(PERMISSIONS.INVENTORY_MANAGE), recordPurchasePaymentController)
  .get(requirePermission(PERMISSIONS.INVENTORY_MANAGE), getPurchasePaymentsController);

export default router;
