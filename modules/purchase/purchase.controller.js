import * as purchaseService from "./purchase.service.js";

export const createPurchaseController = async (req, res, next) => {
  try {
    const { storeId } = req.params;
    const purchase = await purchaseService.createPurchase(req.body, storeId);
    
    res.status(201).json({
      success: true,
      data: purchase
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
