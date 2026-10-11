import {
    createPurchaseOrder,
    getPurchaseOrders,
    getPurchaseOrderById,
    approvePurchaseOrder,
    cancelPurchaseOrder,
    receivePurchaseOrderItems
} from './purchaseOrder.service.js';

export const createPOController = async (req, res) => {
    try {
        const { storeId } = req.params;
        const po = await createPurchaseOrder(storeId, req.body);
        res.status(201).json({ success: true, data: po });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

export const getPOsController = async (req, res) => {
    try {
        const { storeId } = req.params;
        const filters = req.query;
        const pos = await getPurchaseOrders(storeId, filters);
        res.status(200).json({ success: true, data: pos });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

export const getPOByIdController = async (req, res) => {
    try {
        const { storeId, id } = req.params;
        const po = await getPurchaseOrderById(storeId, id);
        res.status(200).json({ success: true, data: po });
    } catch (error) {
        res.status(404).json({ success: false, message: error.message });
    }
};

export const approvePOController = async (req, res) => {
    try {
        const { storeId, id } = req.params;
        const po = await approvePurchaseOrder(storeId, id);
        res.status(200).json({ success: true, data: po, message: 'Purchase Order approved successfully' });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

export const cancelPOController = async (req, res) => {
    try {
        const { storeId, id } = req.params;
        const po = await cancelPurchaseOrder(storeId, id);
        res.status(200).json({ success: true, data: po, message: 'Purchase Order cancelled successfully' });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

export const receivePOItemsController = async (req, res) => {
    try {
        const { storeId, id } = req.params;
        const { receiveData } = req.body;
        const result = await receivePurchaseOrderItems(storeId, id, receiveData);
        res.status(200).json({ success: true, data: result, message: 'Items received and purchase recorded successfully' });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};
