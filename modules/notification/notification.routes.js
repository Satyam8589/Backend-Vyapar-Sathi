import { Router } from 'express';
import authMiddleware from '../../middlewares/auth.middleware.js';
import requireUser from '../../middlewares/requireUser.middleware.js';
import requirePermission from '../../middlewares/requirePermission.middleware.js';
import { PERMISSIONS } from '../../utils/permissions.js';
import {
  getNotificationsController,
  markAsReadController,
  markAllAsReadController,
  getUnreadCountController
} from './notification.controller.js';

const router = Router({ mergeParams: true });

router.use(authMiddleware);
router.use(requireUser);

// Require at least basic dashboard access to view notifications
router.use('/:storeId', requirePermission(PERMISSIONS.DASHBOARD_VIEW));

// GET /api/notifications/:storeId
router.get('/:storeId', getNotificationsController);

// GET /api/notifications/:storeId/unread-count
router.get('/:storeId/unread-count', getUnreadCountController);

// PATCH /api/notifications/:storeId/read-all
router.patch('/:storeId/read-all', markAllAsReadController);

// PATCH /api/notifications/:storeId/:notificationId/read
router.patch('/:storeId/:notificationId/read', markAsReadController);

export default router;
