import {
  createBuyer,
  getBuyers,
  getBuyerById,
  updateBuyer,
  deleteBuyer,
  getBuyerStats,
  getBuyerPurchases,
  getSaleById,
  updateSaleTransaction,
  deleteSaleTransaction,
  sendSaleEmailTransaction,
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
 * GET /api/buyers/:storeId/:buyerId/purchases
 */
export const getBuyerPurchasesController = async (req, res) => {
  try {
    const { storeId, buyerId } = req.params;
    const result = await getBuyerPurchases(storeId, buyerId);
    return res.status(200).json({ success: true, message: 'Buyer purchases fetched successfully', data: result });
  } catch (error) {
    console.error('[BUYER] getBuyerPurchases error:', error);
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

/**
 * GET /api/buyers/:storeId/sales/:saleId
 */
export const getSaleByIdController = async (req, res) => {
  try {
    const { storeId, saleId } = req.params;
    const sale = await getSaleById(storeId, saleId);
    return res.status(200).json({ success: true, message: 'Sale details fetched successfully', data: sale });
  } catch (error) {
    console.error('[BUYER] getSaleById error:', error);
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Internal Server Error',
    });
  }
};

/**
 * PUT /api/buyers/:storeId/sales/:saleId
 */
export const updateSaleTransactionController = async (req, res) => {
  try {
    const { storeId, saleId } = req.params;
    const result = await updateSaleTransaction(storeId, saleId, req.body);
    return res.status(200).json({ success: true, message: 'Sale transaction updated successfully', data: result });
  } catch (error) {
    console.error('[BUYER] updateSaleTransaction error:', error);
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Internal Server Error',
    });
  }
};

/**
 * DELETE /api/buyers/:storeId/sales/:saleId
 */
export const deleteSaleTransactionController = async (req, res) => {
  try {
    const { storeId, saleId } = req.params;
    await deleteSaleTransaction(storeId, saleId);
    return res.status(200).json({ success: true, message: 'Sale transaction deleted successfully', data: null });
  } catch (error) {
    console.error('[BUYER] deleteSaleTransaction error:', error);
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Internal Server Error',
    });
  }
};

/**
 * POST /api/buyers/:storeId/sales/:saleId/send-email
 */
export const sendSaleEmailTransactionController = async (req, res) => {
  try {
    const { storeId, saleId } = req.params;
    const { email } = req.body;
    const result = await sendSaleEmailTransaction(storeId, saleId, email);
    return res.status(200).json({
      success: true,
      message: `Tax invoice email sent successfully to ${result.email}`,
      data: result,
    });
  } catch (error) {
    console.error('[BUYER] sendSaleEmailTransaction error:', error);
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Failed to send tax invoice email',
    });
  }
};
