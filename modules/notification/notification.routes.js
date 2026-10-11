import { Router } from 'express';
import authMiddleware from '../../middlewares/auth.middleware.js';
import requireUser from '../../middlewares/requireUser.middleware.js';
import { Store, Employee } from '../../models/index.js';
import { ApiError } from '../../utils/ApiError.js';
import {
  getNotificationsController,
  markAsReadController,
  markAllAsReadController,
  getUnreadCountController
} from './notification.controller.js';

const router = Router({ mergeParams: true });

router.use(authMiddleware);
router.use(requireUser);

// Ensure user has access to this store (either owner or active employee)
const requireStoreAccess = async (req, res, next) => {
  try {
    const { storeId } = req.params;
    const userId = req.user._id;

    if (!storeId) {
      throw new ApiError('Store ID is required in request parameters', 400);
    }

    const store = await Store.findById(storeId);
    if (!store) {
      throw new ApiError('Store not found', 404);
    }

    if (store.owner.toString() === userId.toString()) {
      req.store = store;
      req.userRole = 'owner';
      return next();
    }

    const employee = await Employee.findOne({
      store: storeId,
      user: userId,
      status: 'active',
    });

    if (!employee) {
      return res.status(403).json({
        success: false,
        message: 'Access Denied: You do not have permission to access this store.',
        statusCode: 403,
      });
    }

    req.store = store;
    req.employee = employee;
    return next();
  } catch (error) {
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Internal Server Error',
      statusCode: error.statusCode || 500,
    });
  }
};

router.use('/:storeId', requireStoreAccess);

// GET /api/notifications/:storeId
router.get('/:storeId', getNotificationsController);

// GET /api/notifications/:storeId/unread-count
router.get('/:storeId/unread-count', getUnreadCountController);

// PATCH /api/notifications/:storeId/read-all
router.patch('/:storeId/read-all', markAllAsReadController);

// PATCH /api/notifications/:storeId/:notificationId/read
router.patch('/:storeId/:notificationId/read', markAsReadController);

export default router;
