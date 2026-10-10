import mongoose from 'mongoose';
import { Seller, PurchaseOrder, GRN, Purchase, PurchaseReturn, Product } from '../../models/index.js';

const calculateScore = (data) => {
    let deliveryScore = 100;
    if (data.onTimeCount + data.delayedCount > 0) {
        deliveryScore = (data.onTimeCount / (data.onTimeCount + data.delayedCount)) * 100;
    }

    let qualityScore = 100;
    if (data.receivedQuantity > 0) {
        qualityScore = 100 - ((data.rejectedQuantity / data.receivedQuantity) * 100);
    }

    let reliabilityScore = 100;
    if (data.totalOrders > 0) {
        reliabilityScore = (data.completedOrders / data.totalOrders) * 100;
    }

    let returnScore = 100;
    if (data.totalPurchaseValue > 0) {
        returnScore = Math.max(0, 100 - ((data.totalReturnValue / data.totalPurchaseValue) * 100));
    } else if (data.totalOrders > 0 && data.totalPurchaseValue === 0) {
       returnScore = 100; 
    }

    if (data.totalOrders === 0 && data.grnCount === 0) {
        return { score: null, status: 'Insufficient Data' };
    }

    const score = (deliveryScore * 0.40) + (qualityScore * 0.30) + (reliabilityScore * 0.20) + (returnScore * 0.10);
    const finalScore = Math.round(score * 10) / 10;
    
    let status = 'Needs Attention';
    if (finalScore >= 90) status = 'Excellent';
    else if (finalScore >= 75) status = 'Good';
    else if (finalScore >= 60) status = 'Average';

    return { score: finalScore, status };
};

export const getSellersPerformanceService = async (storeId, query) => {
    const storeObjectId = new mongoose.Types.ObjectId(storeId);
    
    const { search, page = 1, limit = 20, sortBy = 'score', sortOrder = 'desc' } = query;
    const skip = (Number(page) - 1) * Number(limit);
    
    // Aggregations
    const grnStats = await GRN.aggregate([
        { $match: { store: storeObjectId } },
        {
            $lookup: {
                from: 'purchaseorders',
                localField: 'purchaseOrder',
                foreignField: '_id',
                as: 'po'
            }
        },
        { $unwind: { path: "$po", preserveNullAndEmptyArrays: true } },
        { $unwind: { path: "$items", preserveNullAndEmptyArrays: true } },
        {
            $group: {
                _id: { grn: "$_id", seller: "$seller", receivedDate: "$receivedDate", expectedDate: "$po.expectedDeliveryDate" },
                receivedQty: { $sum: "$items.receivedQuantity" },
                rejectedQty: { $sum: "$items.rejectedQuantity" },
                acceptedQty: { $sum: "$items.acceptedQuantity" },
            }
        },
        {
            $group: {
                _id: "$_id.seller",
                receivedQuantity: { $sum: "$receivedQty" },
                rejectedQuantity: { $sum: "$rejectedQty" },
                acceptedQuantity: { $sum: "$acceptedQty" },
                grnCount: { $sum: 1 },
                onTimeCount: {
                    $sum: {
                        $cond: [
                            { $and: [ { $ne: ["$_id.expectedDate", null] }, { $lte: ["$_id.receivedDate", "$_id.expectedDate"] } ] },
                            1,
                            0
                        ]
                    }
                },
                delayedCount: {
                    $sum: {
                        $cond: [
                            { $and: [ { $ne: ["$_id.expectedDate", null] }, { $gt: ["$_id.receivedDate", "$_id.expectedDate"] } ] },
                            1,
                            0
                        ]
                    }
                },
                delayDays: {
                    $sum: {
                        $cond: [
                            { $and: [ { $ne: ["$_id.expectedDate", null] }, { $gt: ["$_id.receivedDate", "$_id.expectedDate"] } ] },
                            { $divide: [ { $subtract: ["$_id.receivedDate", "$_id.expectedDate"] }, 1000 * 60 * 60 * 24 ] },
                            0
                        ]
                    }
                }
            }
        }
    ]);

    const poStats = await PurchaseOrder.aggregate([
        { $match: { store: storeObjectId } },
        {
            $group: {
                _id: "$seller",
                totalOrders: { $sum: 1 },
                completedOrders: {
                    $sum: { $cond: [{ $in: ["$status", ["Received", "Approved"]] }, 1, 0] }
                },
                totalOrderedQuantity: {
                    $sum: { 
                        $reduce: { 
                            input: "$items", 
                            initialValue: 0, 
                            in: { $add: ["$$value", "$$this.quantity"] } 
                        } 
                    }
                }
            }
        }
    ]);

    const purchaseStats = await Purchase.aggregate([
        { $match: { store: storeObjectId } },
        {
            $group: {
                _id: "$seller",
                totalPurchaseValue: { $sum: "$grandTotal" },
                amountDue: { $sum: "$dueAmount" }
            }
        }
    ]);

    const returnStats = await PurchaseReturn.aggregate([
        { $match: { store: storeObjectId } },
        {
            $group: {
                _id: "$seller",
                totalReturns: { $sum: 1 },
                totalReturnedQuantity: {
                    $sum: {
                        $reduce: {
                            input: "$items",
                            initialValue: 0,
                            in: { $add: ["$$value", "$$this.quantity"] }
                        }
                    }
                },
                totalReturnValue: { $sum: "$refundAmount" }
            }
        }
    ]);

    // Format Maps
    const grnMap = new Map(grnStats.map(g => [g._id.toString(), g]));
    const poMap = new Map(poStats.map(p => [p._id.toString(), p]));
    const purchaseMap = new Map(purchaseStats.map(p => [p._id.toString(), p]));
    const returnMap = new Map(returnStats.map(r => [r._id.toString(), r]));

    let queryObj = { store: storeObjectId };
    if (search) {
        const regex = new RegExp(search, 'i');
        queryObj.$or = [{ name: regex }, { businessName: regex }, { email: regex }, { phone: regex }];
    }

    const sellers = await Seller.find(queryObj).lean();
    
    let result = sellers.map(seller => {
        const sid = seller._id.toString();
        const gs = grnMap.get(sid) || { receivedQuantity: 0, rejectedQuantity: 0, acceptedQuantity: 0, grnCount: 0, onTimeCount: 0, delayedCount: 0, delayDays: 0 };
        const ps = poMap.get(sid) || { totalOrders: 0, completedOrders: 0, totalOrderedQuantity: 0 };
        const pus = purchaseMap.get(sid) || { totalPurchaseValue: 0, amountDue: 0 };
        const rs = returnMap.get(sid) || { totalReturns: 0, totalReturnedQuantity: 0, totalReturnValue: 0 };

        const data = { ...gs, ...ps, ...pus, ...rs };
        const { score, status } = calculateScore(data);

        return {
            seller,
            ...data,
            rejectionRate: gs.receivedQuantity > 0 ? ((gs.rejectedQuantity / gs.receivedQuantity) * 100).toFixed(2) : 0,
            onTimeRate: (gs.onTimeCount + gs.delayedCount) > 0 ? ((gs.onTimeCount / (gs.onTimeCount + gs.delayedCount)) * 100).toFixed(2) : 0,
            averageDelay: gs.delayedCount > 0 ? (gs.delayDays / gs.delayedCount).toFixed(1) : 0,
            score,
            status
        };
    });

    // Sorting
    result.sort((a, b) => {
        let valA = a[sortBy];
        let valB = b[sortBy];
        
        if (sortBy === 'score') {
            valA = valA === null ? -1 : valA;
            valB = valB === null ? -1 : valB;
        }

        if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
        if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
        return 0;
    });

    const total = result.length;
    const paginatedResult = result.slice(skip, skip + Number(limit));

    return {
        data: paginatedResult,
        pagination: {
            total,
            page: Number(page),
            limit: Number(limit),
            totalPages: Math.ceil(total / Number(limit))
        }
    };
};

export const getSellerPerformanceByIdService = async (storeId, sellerId, query) => {
    const storeObjectId = new mongoose.Types.ObjectId(storeId);
    const sellerObjectId = new mongoose.Types.ObjectId(sellerId);
    
    // Aggregations exactly for one seller
    const grnStats = await GRN.aggregate([
        { $match: { store: storeObjectId, seller: sellerObjectId } },
        {
            $lookup: {
                from: 'purchaseorders',
                localField: 'purchaseOrder',
                foreignField: '_id',
                as: 'po'
            }
        },
        { $unwind: { path: "$po", preserveNullAndEmptyArrays: true } },
        { $unwind: { path: "$items", preserveNullAndEmptyArrays: true } },
        {
            $group: {
                _id: { grn: "$_id", receivedDate: "$receivedDate", expectedDate: "$po.expectedDeliveryDate" },
                receivedQty: { $sum: "$items.receivedQuantity" },
                rejectedQty: { $sum: "$items.rejectedQuantity" },
                acceptedQty: { $sum: "$items.acceptedQuantity" },
            }
        },
        {
            $group: {
                _id: null,
                receivedQuantity: { $sum: "$receivedQty" },
                rejectedQuantity: { $sum: "$rejectedQty" },
                acceptedQuantity: { $sum: "$acceptedQty" },
                grnCount: { $sum: 1 },
                onTimeCount: {
                    $sum: {
                        $cond: [
                            { $and: [ { $ne: ["$_id.expectedDate", null] }, { $lte: ["$_id.receivedDate", "$_id.expectedDate"] } ] },
                            1,
                            0
                        ]
                    }
                },
                delayedCount: {
                    $sum: {
                        $cond: [
                            { $and: [ { $ne: ["$_id.expectedDate", null] }, { $gt: ["$_id.receivedDate", "$_id.expectedDate"] } ] },
                            1,
                            0
                        ]
                    }
                },
                delayDays: {
                    $sum: {
                        $cond: [
                            { $and: [ { $ne: ["$_id.expectedDate", null] }, { $gt: ["$_id.receivedDate", "$_id.expectedDate"] } ] },
                            { $divide: [ { $subtract: ["$_id.receivedDate", "$_id.expectedDate"] }, 1000 * 60 * 60 * 24 ] },
                            0
                        ]
                    }
                }
            }
        }
    ]);

    const poStats = await PurchaseOrder.aggregate([
        { $match: { store: storeObjectId, seller: sellerObjectId } },
        {
            $group: {
                _id: null,
                totalOrders: { $sum: 1 },
                completedOrders: {
                    $sum: { $cond: [{ $in: ["$status", ["Received", "Approved"]] }, 1, 0] }
                },
                partiallyReceivedOrders: {
                    $sum: { $cond: [{ $eq: ["$status", "Partially Received"] }, 1, 0] }
                },
                pendingOrders: {
                    $sum: { $cond: [{ $eq: ["$status", "Pending"] }, 1, 0] }
                },
                cancelledOrders: {
                    $sum: { $cond: [{ $eq: ["$status", "Cancelled"] }, 1, 0] }
                },
                overdueOrders: {
                    $sum: { 
                        $cond: [
                            { 
                                $and: [
                                    { $ne: ["$expectedDeliveryDate", null] },
                                    { $lt: ["$expectedDeliveryDate", new Date()] },
                                    { $nin: ["$status", ["Received", "Approved", "Cancelled"]] }
                                ]
                            }, 
                            1, 
                            0
                        ] 
                    }
                },
                totalOrderedQuantity: {
                    $sum: { 
                        $reduce: { 
                            input: "$items", 
                            initialValue: 0, 
                            in: { $add: ["$$value", "$$this.quantity"] } 
                        } 
                    }
                }
            }
        }
    ]);

    const purchaseStats = await Purchase.aggregate([
        { $match: { store: storeObjectId, seller: sellerObjectId } },
        {
            $group: {
                _id: null,
                totalPurchaseValue: { $sum: "$grandTotal" },
                amountPaid: { $sum: "$paidAmount" },
                amountDue: { $sum: "$dueAmount" }
            }
        }
    ]);

    const returnStats = await PurchaseReturn.aggregate([
        { $match: { store: storeObjectId, seller: sellerObjectId } },
        { $unwind: { path: "$items", preserveNullAndEmptyArrays: true } },
        {
            $group: {
                _id: null,
                totalReturnedQuantity: { $sum: "$items.quantity" },
                totalReturnValue: { $sum: "$items.total" } 
            }
        }
    ]);
    
    // Fix returnCount
    const returnCountAgg = await PurchaseReturn.countDocuments({ store: storeObjectId, seller: sellerObjectId });

    const gs = grnStats[0] || { receivedQuantity: 0, rejectedQuantity: 0, acceptedQuantity: 0, grnCount: 0, onTimeCount: 0, delayedCount: 0, delayDays: 0 };
    const ps = poStats[0] || { totalOrders: 0, completedOrders: 0, partiallyReceivedOrders: 0, pendingOrders: 0, cancelledOrders: 0, overdueOrders: 0, totalOrderedQuantity: 0 };
    const pus = purchaseStats[0] || { totalPurchaseValue: 0, amountDue: 0, amountPaid: 0 };
    const rs = returnStats[0] || { totalReturnedQuantity: 0, totalReturnValue: 0 };
    rs.totalReturns = returnCountAgg;

    const data = { ...gs, ...ps, ...pus, ...rs };
    const { score, status } = calculateScore(data);

    // Trend by month
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
    sixMonthsAgo.setDate(1);
    
    const trendStats = await GRN.aggregate([
        { $match: { store: storeObjectId, seller: sellerObjectId, receivedDate: { $gte: sixMonthsAgo } } },
        { $unwind: { path: "$items", preserveNullAndEmptyArrays: true } },
        {
            $group: {
                _id: { year: { $year: "$receivedDate" }, month: { $month: "$receivedDate" } },
                received: { $sum: "$items.receivedQuantity" },
                rejected: { $sum: "$items.rejectedQuantity" }
            }
        },
        { $sort: { "_id.year": 1, "_id.month": 1 } }
    ]);

    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const trends = trendStats.map(t => ({
        month: `${months[t._id.month - 1]} ${t._id.year}`,
        received: t.received,
        rejected: t.rejected,
        rejectionRate: t.received > 0 ? Number(((t.rejected / t.received) * 100).toFixed(2)) : 0
    }));
    
    // Products from this supplier
    const productsStats = await GRN.aggregate([
        { $match: { store: storeObjectId, seller: sellerObjectId } },
        { $unwind: "$items" },
        {
            $group: {
                _id: "$items.product",
                receivedQty: { $sum: "$items.receivedQuantity" },
                rejectedQty: { $sum: "$items.rejectedQuantity" },
                acceptedQty: { $sum: "$items.acceptedQuantity" },
                totalPurchaseValue: { $sum: "$items.total" },
                ordersCount: { $addToSet: "$purchaseOrder" }
            }
        },
        {
            $lookup: {
                from: 'products',
                localField: '_id',
                foreignField: '_id',
                as: 'productDetails'
            }
        },
        { $unwind: { path: "$productDetails", preserveNullAndEmptyArrays: true } },
        {
            $project: {
                _id: 1,
                name: "$productDetails.name",
                sku: "$productDetails.sku",
                receivedQty: 1,
                rejectedQty: 1,
                acceptedQty: 1,
                totalPurchaseValue: 1,
                orders: { $size: "$ordersCount" },
                rejectionRate: {
                    $cond: [
                        { $gt: ["$receivedQty", 0] },
                        { $multiply: [{ $divide: ["$rejectedQty", "$receivedQty"] }, 100] },
                        0
                    ]
                }
            }
        },
        { $sort: { orders: -1 } }
    ]);

    return {
        summary: {
            ...data,
            rejectionRate: gs.receivedQuantity > 0 ? Number(((gs.rejectedQuantity / gs.receivedQuantity) * 100).toFixed(2)) : 0,
            onTimeRate: (gs.onTimeCount + gs.delayedCount) > 0 ? Number(((gs.onTimeCount / (gs.onTimeCount + gs.delayedCount)) * 100).toFixed(2)) : 0,
            averageDelay: gs.delayedCount > 0 ? Number((gs.delayDays / gs.delayedCount).toFixed(1)) : 0,
        },
        score: {
            total: score,
            status
        },
        trends,
        products: productsStats
    };
};
