import GRN from '../../models/grn.model.js';

export const getGRNs = async (storeId, filters = {}) => {
    const query = { store: storeId };
    
    if (filters.status) query.status = filters.status;
    if (filters.seller) query.seller = filters.seller;
    
    if (filters.search) {
        query.grnNumber = { $regex: filters.search, $options: 'i' };
    }

    const grns = await GRN.find(query)
        .populate('seller', 'name email phone')
        .populate('purchaseOrder', 'poNumber')
        .populate('items.product', 'name sku')
        .sort({ receivedDate: -1 });

    return grns;
};

export const getGRNById = async (storeId, grnId) => {
    const grn = await GRN.findOne({ _id: grnId, store: storeId })
        .populate('seller', 'name email phone address')
        .populate('purchaseOrder', 'poNumber expectedDeliveryDate')
        .populate('items.product', 'name sku hsnCode')
        .populate('linkedPurchase', 'invoiceNumber')
        .populate('createdBy', 'name');
    
    if (!grn) throw new Error('GRN not found');
    return grn;
};
