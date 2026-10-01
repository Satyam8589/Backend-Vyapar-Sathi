import {
  createSeller,
  getSellers,
  getSellerById,
  updateSeller,
  deleteSeller,
  getSellerStats,
} from './seller.service.js';

/**
 * POST /api/sellers/:storeId
 */
export const createSellerController = async (req, res) => {
  try {
    const { storeId } = req.params;
    const { name, businessName, phone, email, address, GSTIN } = req.body;

    if (!name || !phone) {
      return res.status(400).json({ success: false, message: 'Name and phone are required' });
    }

    const seller = await createSeller(storeId, { name, businessName, phone, email, address, GSTIN });
    return res.status(201).json({ success: true, message: 'Seller created successfully', data: seller });
  } catch (error) {
    console.error('[SELLER] createSeller error:', error);
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Internal Server Error',
    });
  }
};

/**
 * GET /api/sellers/:storeId
 */
export const getSellersController = async (req, res) => {
  try {
    const { storeId } = req.params;
    const { search, status, page, limit } = req.query;

    const result = await getSellers(storeId, { search, status, page, limit });
    return res.status(200).json({ success: true, message: 'Sellers fetched successfully', data: result });
  } catch (error) {
    console.error('[SELLER] getSellers error:', error);
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Internal Server Error',
    });
  }
};

/**
 * GET /api/sellers/:storeId/stats
 */
export const getSellerStatsController = async (req, res) => {
  try {
    const { storeId } = req.params;
    const stats = await getSellerStats(storeId);
    return res.status(200).json({ success: true, message: 'Seller stats fetched', data: stats });
  } catch (error) {
    console.error('[SELLER] getSellerStats error:', error);
    return res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};

/**
 * GET /api/sellers/:storeId/:sellerId
 */
export const getSellerByIdController = async (req, res) => {
  try {
    const { storeId, sellerId } = req.params;
    const seller = await getSellerById(storeId, sellerId);
    return res.status(200).json({ success: true, message: 'Seller fetched successfully', data: seller });
  } catch (error) {
    console.error('[SELLER] getSellerById error:', error);
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Internal Server Error',
    });
  }
};

/**
 * PUT /api/sellers/:storeId/:sellerId
 */
export const updateSellerController = async (req, res) => {
  try {
    const { storeId, sellerId } = req.params;
    const seller = await updateSeller(storeId, sellerId, req.body);
    return res.status(200).json({ success: true, message: 'Seller updated successfully', data: seller });
  } catch (error) {
    console.error('[SELLER] updateSeller error:', error);
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Internal Server Error',
    });
  }
};

/**
 * DELETE /api/sellers/:storeId/:sellerId
 */
export const deleteSellerController = async (req, res) => {
  try {
    const { storeId, sellerId } = req.params;
    await deleteSeller(storeId, sellerId);
    return res.status(200).json({ success: true, message: 'Seller deleted successfully', data: null });
  } catch (error) {
    console.error('[SELLER] deleteSeller error:', error);
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Internal Server Error',
    });
  }
};
