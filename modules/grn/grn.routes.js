import express from 'express';
import { getGRNsController, getGRNByIdController } from './grn.controller.js';
import authMiddleware from '../../middlewares/auth.middleware.js';
import requireUser from '../../middlewares/requireUser.middleware.js';
import requirePermission from '../../middlewares/requirePermission.middleware.js';
import { PERMISSIONS } from '../../utils/permissions.js';

const router = express.Router({ mergeParams: true });

router.use(authMiddleware);
router.use(requireUser);

router.route('/:storeId')
    .get(requirePermission(PERMISSIONS.INVENTORY_MANAGE), getGRNsController);

router.route('/:storeId/:id')
    .get(requirePermission(PERMISSIONS.INVENTORY_MANAGE), getGRNByIdController);

export default router;
