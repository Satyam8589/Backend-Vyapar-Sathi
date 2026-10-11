import { Router } from 'express';
import authMiddleware from '../../middlewares/auth.middleware.js';
import requireUser from '../../middlewares/requireUser.middleware.js';
import requirePermission from '../../middlewares/requirePermission.middleware.js';
import { PERMISSIONS } from '../../utils/permissions.js';
import {
    createPOController,
    getPOsController,
    getPOByIdController,
    approvePOController,
    cancelPOController,
    receivePOItemsController
} from './purchaseOrder.controller.js';

const router = Router({ mergeParams: true });

router.use(authMiddleware);
router.use(requireUser);

// GET  /api/purchase-orders/:storeId
// POST /api/purchase-orders/:storeId
router.route('/:storeId')
    .get(requirePermission(PERMISSIONS.INVENTORY_MANAGE), getPOsController)
    .post(requirePermission(PERMISSIONS.INVENTORY_MANAGE), createPOController);

// GET  /api/purchase-orders/:storeId/:id
router.route('/:storeId/:id')
    .get(requirePermission(PERMISSIONS.INVENTORY_MANAGE), getPOByIdController);

// PATCH /api/purchase-orders/:storeId/:id/approve
router.route('/:storeId/:id/approve')
    .patch(requirePermission(PERMISSIONS.INVENTORY_MANAGE), approvePOController);

// PATCH /api/purchase-orders/:storeId/:id/cancel
router.route('/:storeId/:id/cancel')
    .patch(requirePermission(PERMISSIONS.INVENTORY_MANAGE), cancelPOController);

// POST /api/purchase-orders/:storeId/:id/receive
router.route('/:storeId/:id/receive')
    .post(requirePermission(PERMISSIONS.INVENTORY_MANAGE), receivePOItemsController);

export default router;
