import mongoose from 'mongoose';
import PurchaseOrder from '../../models/purchaseOrder.model.js';
import Product from '../../models/product.model.js';
import Store from '../../models/store.model.js';
import Seller from '../../models/seller.model.js';
import Purchase from '../../models/purchase.model.js';
import GRN from '../../models/grn.model.js';
import { createNotificationService } from '../notification/notification.service.js';
import { Notification } from '../../models/index.js';

export const createPurchaseOrder = async (storeId, data) => {
    const { sellerId, poNumber, orderDate, expectedDeliveryDate, items, notes } = data;

    const seller = await Seller.findOne({ _id: sellerId, store: storeId });
    if (!seller) throw new Error('Seller not found or unauthorized');

    const existingPO = await PurchaseOrder.findOne({ store: storeId, poNumber });
    if (existingPO) throw new Error(`PO Number ${poNumber} already exists`);

    let subtotal = 0;
    let discount = 0;
    let tax = 0;
    let grandTotal = 0;

    const poItems = [];

    for (const item of items) {
        const product = await Product.findOne({ _id: item.productId, store: storeId });
        if (!product) throw new Error(`Product ${item.productId} not found`);

        const itemSubtotal = (item.quantity * item.purchasePrice) - (item.discount || 0) + (item.tax || 0);
        
        poItems.push({
            product: product._id,
            quantity: item.quantity,
            receivedQuantity: 0,
            purchasePrice: item.purchasePrice,
            discount: item.discount || 0,
            tax: item.tax || 0,
            subtotal: itemSubtotal
        });

        subtotal += (item.quantity * item.purchasePrice);
        discount += (item.discount || 0);
        tax += (item.tax || 0);
        grandTotal += itemSubtotal;
    }

    const newPO = new PurchaseOrder({
        store: storeId,
        seller: seller._id,
        poNumber,
        orderDate,
        expectedDeliveryDate,
        items: poItems,
        subtotal,
        discount,
        tax,
        grandTotal,
        notes,
        status: 'Pending'
    });

    await newPO.save();

    // Create a notification for Pending PO
    try {
        await createNotificationService({
            storeId,
            type: 'PURCHASE_ORDER_PENDING',
            title: 'Purchase Order Pending',
            message: `Purchase Order ${poNumber} is waiting for approval.`,
            relatedEntityType: 'PurchaseOrder',
            relatedEntityId: newPO._id,
            priority: 'MEDIUM'
        });
    } catch (err) {
        console.error('Failed to create PO Pending notification:', err);
    }

    return newPO;
};

export const getPurchaseOrders = async (storeId, filters = {}) => {
    const query = { store: storeId };
    
    if (filters.status) query.status = filters.status;
    if (filters.seller) query.seller = filters.seller;
    
    if (filters.search) {
        query.poNumber = { $regex: filters.search, $options: 'i' };
    }

    const pos = await PurchaseOrder.find(query)
        .populate('seller', 'name email phone')
        .populate('items.product', 'name sku')
        .sort({ orderDate: -1 });

    return pos;
};

export const getPurchaseOrderById = async (storeId, poId) => {
    const po = await PurchaseOrder.findOne({ _id: poId, store: storeId })
        .populate('seller', 'name email phone address')
        .populate('items.product', 'name sku hsnCode')
        .populate('linkedPurchases');
    
    if (!po) throw new Error('Purchase Order not found');
    return po;
};

export const approvePurchaseOrder = async (storeId, poId) => {
    const po = await PurchaseOrder.findOne({ _id: poId, store: storeId });
    if (!po) throw new Error('Purchase Order not found');
    
    if (po.status !== 'Draft' && po.status !== 'Pending') {
        throw new Error(`Cannot approve a PO with status ${po.status}`);
    }

    po.status = 'Approved';
    await po.save();

    // Mark pending notification as read
    try {
        await Notification.updateMany(
            { store: storeId, type: 'PURCHASE_ORDER_PENDING', relatedEntityId: po._id, isRead: false },
            { isRead: true }
        );
    } catch (err) {}

    return po;
};

export const cancelPurchaseOrder = async (storeId, poId) => {
    const po = await PurchaseOrder.findOne({ _id: poId, store: storeId });
    if (!po) throw new Error('Purchase Order not found');
    
    if (po.status !== 'Draft' && po.status !== 'Pending' && po.status !== 'Approved') {
        throw new Error(`Cannot cancel a PO with status ${po.status}`);
    }

    po.status = 'Cancelled';
    await po.save();

    // Mark pending notification as read if cancelled
    try {
        await Notification.updateMany(
            { store: storeId, type: 'PURCHASE_ORDER_PENDING', relatedEntityId: po._id, isRead: false },
            { isRead: true }
        );
    } catch (err) {}

    return po;
};

export const receivePurchaseOrderItems = async (storeId, poId, receiveData, userId, notes) => {
    // receiveData format: [{ productId, acceptedQuantity, rejectedQuantity }, ...]
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const po = await PurchaseOrder.findOne({ _id: poId, store: storeId }).session(session);
        if (!po) throw new Error('Purchase Order not found');

        if (!['Approved', 'Partially Received'].includes(po.status)) {
            throw new Error(`Cannot receive items for a PO with status ${po.status}`);
        }

        const purchaseItems = [];
        const grnItems = [];
        let purchaseSubtotal = 0;
        let purchaseDiscount = 0;
        let purchaseTax = 0;
        let purchaseGrandTotal = 0;

        for (const receiveItem of receiveData) {
            const poItem = po.items.find(i => i.product.toString() === receiveItem.productId);
            if (!poItem) throw new Error(`Product ${receiveItem.productId} not found in PO`);

            const acceptedQty = Number(receiveItem.acceptedQuantity) || 0;
            const rejectedQty = Number(receiveItem.rejectedQuantity) || 0;
            const totalReceivedQty = acceptedQty + rejectedQty;

            if (totalReceivedQty <= 0) continue;
            if (acceptedQty < 0 || rejectedQty < 0) throw new Error('Quantities cannot be negative');

            const remaining = poItem.quantity - poItem.receivedQuantity;
            if (totalReceivedQty > remaining) {
                throw new Error(`Cannot receive more than remaining quantity for product ${receiveItem.productId}`);
            }

            // Update Product Stock for accepted quantity only
            if (acceptedQty > 0) {
                const product = await Product.findOne({ _id: receiveItem.productId, store: storeId }).session(session);
                if (!product) throw new Error(`Product ${receiveItem.productId} not found`);

                product.stock += acceptedQty;
                await product.save({ session });
            }

            // Prepare GRN Item
            const itemTotal = totalReceivedQty * poItem.purchasePrice;
            grnItems.push({
                product: poItem.product,
                orderedQuantity: poItem.quantity,
                previouslyReceivedQuantity: poItem.receivedQuantity,
                receivedQuantity: totalReceivedQty,
                rejectedQuantity: rejectedQty,
                acceptedQuantity: acceptedQty,
                purchasePrice: poItem.purchasePrice,
                total: itemTotal
            });

            // Update PO item
            poItem.receivedQuantity += totalReceivedQty;

            // Prepare Purchase Item (only for accepted quantity)
            if (acceptedQty > 0) {
                const proportion = acceptedQty / poItem.quantity;
                const itemDiscount = poItem.discount * proportion;
                const itemTax = poItem.tax * proportion;
                const itemSubtotal = (acceptedQty * poItem.purchasePrice) - itemDiscount + itemTax;

                purchaseItems.push({
                    product: poItem.product,
                    quantity: acceptedQty,
                    purchasePrice: poItem.purchasePrice,
                    discount: itemDiscount,
                    tax: itemTax,
                    subtotal: itemSubtotal
                });

                purchaseSubtotal += (acceptedQty * poItem.purchasePrice);
                purchaseDiscount += itemDiscount;
                purchaseTax += itemTax;
                purchaseGrandTotal += itemSubtotal;
            }
        }

        if (grnItems.length === 0) {
            throw new Error("No items to receive");
        }

        po.updateStatusBasedOnReceipts();
        
        let newPurchase = null;
        if (purchaseItems.length > 0) {
            // Generate an invoice number for the linked purchase
            const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
            const randomNum = Math.floor(1000 + Math.random() * 9000);
            const invoiceNumber = `REC-${po.poNumber}-${dateStr}-${randomNum}`;

            newPurchase = new Purchase({
                store: storeId,
                seller: po.seller,
                invoiceNumber,
                purchaseDate: new Date(),
                items: purchaseItems,
                subtotal: purchaseSubtotal,
                discount: purchaseDiscount,
                tax: purchaseTax,
                grandTotal: purchaseGrandTotal,
                notes: `Received from PO: ${po.poNumber}`
            });

            await newPurchase.save({ session });
            po.linkedPurchases.push(newPurchase._id);
        }

        await po.save({ session });

        // Generate GRN Number
        const grnCount = await GRN.countDocuments({ store: storeId }).session(session);
        const grnNumber = `GRN-${new Date().getFullYear()}-${String(grnCount + 1).padStart(4, '0')}`;

        // Create GRN
        const newGRN = new GRN({
            store: storeId,
            purchaseOrder: po._id,
            seller: po.seller,
            grnNumber,
            receivedDate: new Date(),
            items: grnItems,
            notes,
            createdBy: userId,
            status: 'Completed',
            linkedPurchase: newPurchase ? newPurchase._id : null
        });

        await newGRN.save({ session });

        await session.commitTransaction();
        session.endSession();

        return { purchaseOrder: po, purchase: newPurchase, grn: newGRN };
    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        throw error;
    }
};
