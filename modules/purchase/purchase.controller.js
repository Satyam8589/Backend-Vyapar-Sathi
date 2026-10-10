import * as purchaseService from "./purchase.service.js";
import * as purchaseReportService from "./purchaseReport.service.js";
import * as purchasePaymentService from "./purchasePayment.service.js";
import { getReorderSuggestions } from "./purchaseReorder.service.js";

export const getReorderSuggestionsController = async (req, res, next) => {
  try {
    const { storeId } = req.params;
    const result = await getReorderSuggestions(storeId);
    
    res.status(200).json({
      success: true,
      message: "Smart reorder suggestions fetched successfully",
      data: result
    });
  } catch (error) {
    next(error);
  }
};

export const createPurchaseController = async (req, res, next) => {
  try {
    const { storeId } = req.params;
    const result = await purchaseService.createPurchase(req.body, storeId);
    
    res.status(201).json({
      success: true,
      data: result,
      stockUpdated: result.stockUpdated ?? true
    });
  } catch (error) {
    next(error);
  }
};

export const getPurchasesController = async (req, res, next) => {
  try {
    const { storeId } = req.params;
    const result = await purchaseService.getPurchases(storeId, req.query);
    
    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
};

export const getPurchaseByIdController = async (req, res, next) => {
  try {
    const { storeId, purchaseId } = req.params;
    const purchase = await purchaseService.getPurchaseById(purchaseId, storeId);
    
    res.status(200).json({
      success: true,
      data: purchase
    });
  } catch (error) {
    next(error);
  }
};

export const updatePurchaseController = async (req, res, next) => {
  try {
    const { storeId, purchaseId } = req.params;
    const purchase = await purchaseService.updatePurchase(purchaseId, req.body, storeId);
    
    res.status(200).json({
      success: true,
      data: purchase
    });
  } catch (error) {
    next(error);
  }
};

export const deletePurchaseController = async (req, res, next) => {
  try {
    const { storeId, purchaseId } = req.params;
    await purchaseService.deletePurchase(purchaseId, storeId);
    
    res.status(200).json({
      success: true,
      message: "Purchase deleted successfully"
    });
  } catch (error) {
    next(error);
  }
};

export const returnPurchaseController = async (req, res, next) => {
  try {
    const { storeId, purchaseId } = req.params;
    const result = await purchaseService.createPurchaseReturn(purchaseId, storeId, req.body);
    
    res.status(201).json({
      success: true,
      message: "Purchase return completed successfully",
      data: result
    });
  } catch (error) {
    next(error);
  }
};

export const getPurchaseReturnsController = async (req, res, next) => {
  try {
    const { storeId, purchaseId } = req.params;
    const result = await purchaseService.getPurchaseReturns(purchaseId, storeId);
    
    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
};

export const getPurchaseAnalyticsController = async (req, res, next) => {
  try {
    const { storeId } = req.params;
    const result = await purchaseService.getPurchaseAnalytics(storeId, req.query);
    
    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
};

export const getPurchaseReportsController = async (req, res, next) => {
  try {
    const { storeId } = req.params;
    const result = await purchaseReportService.generatePurchaseReport(storeId, req.query);
    
    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
};

export const recordPurchasePaymentController = async (req, res, next) => {
  try {
    const { storeId, purchaseId } = req.params;
    const userId = req.user?._id;
    const result = await purchasePaymentService.recordPurchasePayment(storeId, purchaseId, userId, req.body);
    
    res.status(201).json({
      success: true,
      message: "Payment recorded successfully",
      data: result
    });
  } catch (error) {
    next(error);
  }
};

export const getPurchasePaymentsController = async (req, res, next) => {
  try {
    const { storeId, purchaseId } = req.params;
    const result = await purchasePaymentService.getPurchasePayments(storeId, purchaseId);
    
    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
};

