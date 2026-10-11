import catchAsync from '../../utils/catchAsync.js';
import { ApiResponse } from '../../utils/ApiResponse.js';
import {
  getNotificationsService,
  getUnreadCountService,
  markAsReadService,
  markAllAsReadService
} from './notification.service.js';

export const getNotificationsController = catchAsync(async (req, res) => {
  const { storeId } = req.params;
  const result = await getNotificationsService(storeId, req.query);

  res.status(200).json(
    new ApiResponse(result, 'Notifications retrieved successfully', 200)
  );
});

export const getUnreadCountController = catchAsync(async (req, res) => {
  const { storeId } = req.params;
  const result = await getUnreadCountService(storeId);

  res.status(200).json(
    new ApiResponse(result, 'Unread count retrieved successfully', 200)
  );
});

export const markAsReadController = catchAsync(async (req, res) => {
  const { storeId, notificationId } = req.params;
  const result = await markAsReadService(storeId, notificationId);

  res.status(200).json(
    new ApiResponse(result, 'Notification marked as read', 200)
  );
});

export const markAllAsReadController = catchAsync(async (req, res) => {
  const { storeId } = req.params;
  const result = await markAllAsReadService(storeId);

  res.status(200).json(
    new ApiResponse(result, 'All notifications marked as read', 200)
  );
});
