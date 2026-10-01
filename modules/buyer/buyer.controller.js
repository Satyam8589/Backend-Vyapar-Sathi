import {
  createBuyer,
  getBuyers,
  getBuyerById,
  updateBuyer,
  deleteBuyer,
  getBuyerStats,
} from './buyer.service.js';

/**
 * POST /api/buyers/:storeId
 */
export const createBuyerController = async (req, res) => {
  try {
    const { storeId } = req.params;
    const { name, phone, email, address, GSTIN } = req.body;

    if (!name || !phone) {
      return res.status(400).json({ success: false, message: 'Name and phone are required' });
    }

    const buyer = await createBuyer(storeId, { name, phone, email, address, GSTIN });
    return res.status(201).json({ success: true, message: 'Buyer created successfully', data: buyer });
  } catch (error) {
    console.error('[BUYER] createBuyer error:', error);
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Internal Server Error',
    });
  }
};

/**
 * GET /api/buyers/:storeId
 */
export const getBuyersController = async (req, res) => {
  try {
    const { storeId } = req.params;
    const { search, status, page, limit } = req.query;

    const result = await getBuyers(storeId, { search, status, page, limit });
    return res.status(200).json({ success: true, message: 'Buyers fetched successfully', data: result });
  } catch (error) {
    console.error('[BUYER] getBuyers error:', error);
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Internal Server Error',
    });
  }
};

/**
 * GET /api/buyers/:storeId/stats
 */
export const getBuyerStatsController = async (req, res) => {
  try {
    const { storeId } = req.params;
    const stats = await getBuyerStats(storeId);
    return res.status(200).json({ success: true, message: 'Buyer stats fetched', data: stats });
  } catch (error) {
    console.error('[BUYER] getBuyerStats error:', error);
    return res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};

/**
 * GET /api/buyers/:storeId/:buyerId
 */
export const getBuyerByIdController = async (req, res) => {
  try {
    const { storeId, buyerId } = req.params;
    const buyer = await getBuyerById(storeId, buyerId);
    return res.status(200).json({ success: true, message: 'Buyer fetched successfully', data: buyer });
  } catch (error) {
    console.error('[BUYER] getBuyerById error:', error);
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Internal Server Error',
    });
  }
};

/**
 * PUT /api/buyers/:storeId/:buyerId
 */
export const updateBuyerController = async (req, res) => {
  try {
    const { storeId, buyerId } = req.params;
    const buyer = await updateBuyer(storeId, buyerId, req.body);
    return res.status(200).json({ success: true, message: 'Buyer updated successfully', data: buyer });
  } catch (error) {
    console.error('[BUYER] updateBuyer error:', error);
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Internal Server Error',
    });
  }
};

/**
 * DELETE /api/buyers/:storeId/:buyerId
 */
export const deleteBuyerController = async (req, res) => {
  try {
    const { storeId, buyerId } = req.params;
    await deleteBuyer(storeId, buyerId);
    return res.status(200).json({ success: true, message: 'Buyer deleted successfully', data: null });
  } catch (error) {
    console.error('[BUYER] deleteBuyer error:', error);
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Internal Server Error',
    });
  }
};
