import mongoose from 'mongoose';
import Product from '../../models/product.model.js';
import Inventory from '../../models/inventory.model.js';
import PurchaseOrder from '../../models/purchaseOrder.model.js';
import Sale from '../../models/sale.model.js';
import Purchase from '../../models/purchase.model.js';
import { getSellersPerformanceService } from '../seller/seller.performance.service.js';

export const getReorderSuggestions = async (storeId) => {
    const storeObjectId = new mongoose.Types.ObjectId(storeId);

    // 1. Get products and inventory levels
    const products = await Product.find({ store: storeObjectId, isActive: true }).lean();
    const inventoryData = await Inventory.find({ store: storeObjectId }).lean();
    
    const inventoryMap = new Map(inventoryData.map(inv => [inv.product.toString(), inv]));

    // 2. Calculate incoming stock from active POs
    const incomingPOs = await PurchaseOrder.aggregate([
        { $match: { store: storeObjectId, status: { $in: ['Pending', 'Approved', 'Partially Received'] } } },
        { $unwind: '$items' },
        {
            $group: {
                _id: '$items.product',
                incomingQuantity: { $sum: { $subtract: ['$items.quantity', '$items.receivedQuantity'] } }
            }
        }
    ]);
    const incomingMap = new Map(incomingPOs.map(po => [po._id.toString(), po.incomingQuantity]));

    // 3. Calculate average daily demand over the last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const salesData = await Sale.aggregate([
        { $match: { store: storeObjectId, completedAt: { $gte: thirtyDaysAgo } } },
        { $unwind: '$items' },
        {
            $group: {
                _id: '$items.productId',
                totalSold: { $sum: '$items.quantity' }
            }
        }
    ]);
    const demandMap = new Map(salesData.map(s => [s._id.toString(), s.totalSold / 30]));

    // 4. Get previous purchase history to identify suppliers for each product
    const productSuppliersAgg = await Purchase.aggregate([
        { $match: { store: storeObjectId } },
        { $unwind: '$items' },
        { $sort: { purchaseDate: -1 } },
        {
            $group: {
                _id: { product: '$items.product', seller: '$seller' },
                lastPurchasePrice: { $first: '$items.purchasePrice' }
            }
        },
        {
            $group: {
                _id: '$_id.product',
                suppliers: {
                    $push: {
                        sellerId: '$_id.seller',
                        purchasePrice: '$lastPurchasePrice'
                    }
                }
            }
        }
    ]);
    const productSuppliersMap = new Map(productSuppliersAgg.map(p => [p._id.toString(), p.suppliers]));

    // 5. Get supplier performance
    const sellerPerformance = await getSellersPerformanceService(storeId, { limit: 1000 });
    const sellerScores = new Map(sellerPerformance.data.map(sp => [sp.seller._id.toString(), sp]));

    const suggestions = [];
    const summary = {
        productsToReorder: 0,
        outOfStock: 0,
        criticalStock: 0,
        highDemand: 0,
        estimatedReorderCost: 0,
        pendingOrders: incomingPOs.length > 0 ? await PurchaseOrder.countDocuments({ store: storeObjectId, status: { $in: ['Pending', 'Approved', 'Partially Received'] } }) : 0
    };

    for (const product of products) {
        const prodId = product._id.toString();
        const inv = inventoryMap.get(prodId);
        
        const currentStock = product.quantity || 0;
        const reorderLevel = inv ? (inv.minStockLevel || 10) : 10;
        const incomingStock = incomingMap.get(prodId) || 0;
        const dailyDemand = demandMap.get(prodId) || 0;
        
        const isOutOfStock = currentStock <= 0;
        const isLowStock = currentStock <= reorderLevel;

        if (isOutOfStock) summary.outOfStock++;
        if (currentStock > 0 && currentStock <= (reorderLevel / 2)) summary.criticalStock++;
        if (dailyDemand > 5) summary.highDemand++; // Arbitrary threshold for high demand

        // Supplier selection logic
        const suppliersList = productSuppliersMap.get(prodId) || [];
        let preferredSupplier = null;
        let suppliersWithScores = suppliersList.map(s => {
            const perf = sellerScores.get(s.sellerId.toString());
            return {
                ...s,
                score: perf ? perf.score : 50, // default score if no history
                onTimeRate: perf ? perf.onTimeRate : 50,
                rejectionRate: perf ? perf.rejectionRate : 0,
                seller: perf ? perf.seller : null
            };
        });

        if (suppliersWithScores.length > 0) {
            // Sort by score (descending), then purchase price (ascending)
            suppliersWithScores.sort((a, b) => {
                if (b.score !== a.score) return b.score - a.score;
                return a.purchasePrice - b.purchasePrice;
            });
            preferredSupplier = suppliersWithScores[0];
        }

        const leadTimeDays = 7; // Default lead time
        const safetyStock = Math.ceil(dailyDemand * 3); // 3 days safety stock
        
        let targetStock = Math.ceil(dailyDemand * leadTimeDays) + safetyStock;
        if (targetStock < reorderLevel) targetStock = reorderLevel * 2; // Ensure minimum reasonable order
        
        let suggestedQuantity = targetStock - currentStock - incomingStock;
        
        // Ensure suggestedQuantity is a reasonable positive number if low stock
        if (isLowStock && suggestedQuantity <= 0) {
           suggestedQuantity = reorderLevel;
        }

        if (isOutOfStock || isLowStock || suggestedQuantity > 0) {
            
            // Re-check suggested quantity to prevent negatives just in case
            if (suggestedQuantity < 0) suggestedQuantity = 0;
            
            // Only add if there is something to suggest OR stock is critical/out of stock
            if (suggestedQuantity > 0) {
                summary.productsToReorder++;
                
                let priority = 'LOW';
                if (isOutOfStock) priority = 'CRITICAL';
                else if (currentStock <= (reorderLevel / 2)) priority = 'HIGH';
                else priority = 'MEDIUM';

                const estimatedPrice = preferredSupplier ? preferredSupplier.purchasePrice : product.buyingPrice;
                const estimatedCost = estimatedPrice * suggestedQuantity;
                
                summary.estimatedReorderCost += estimatedCost;

                // Stock out risk (days left)
                let daysOfStock = -1;
                if (dailyDemand > 0) {
                    daysOfStock = currentStock / dailyDemand;
                }

                let reason = [];
                if (isOutOfStock) reason.push('Out of stock');
                else if (isLowStock) reason.push('Below reorder level');
                
                if (dailyDemand > 3) reason.push('High recent demand');
                
                let riskStatus = 'Safe';
                if (daysOfStock >= 0) {
                    if (daysOfStock < 3) riskStatus = 'Critical';
                    else if (daysOfStock < leadTimeDays) riskStatus = 'At Risk';
                    else if (daysOfStock < leadTimeDays + 3) riskStatus = 'Watch';
                } else if (isOutOfStock) {
                    riskStatus = 'Critical';
                } else if (currentStock > 0 && dailyDemand === 0) {
                    riskStatus = 'Safe (No demand)';
                }

                suggestions.push({
                    product: {
                        _id: product._id,
                        name: product.name,
                        sku: product.sku,
                        barcode: product.barcode,
                        image: product.image
                    },
                    currentStock,
                    reorderLevel,
                    dailyDemand: Number(dailyDemand.toFixed(2)),
                    daysOfStock: daysOfStock >= 0 ? Number(daysOfStock.toFixed(1)) : 'N/A',
                    stockRisk: riskStatus,
                    incomingQuantity: incomingStock,
                    suggestedQuantity: Math.ceil(suggestedQuantity),
                    estimatedPrice,
                    estimatedCost,
                    priority,
                    reason: reason.join(' and '),
                    preferredSupplier: preferredSupplier ? {
                        _id: preferredSupplier.sellerId,
                        name: preferredSupplier.seller ? preferredSupplier.seller.name : 'Unknown',
                        businessName: preferredSupplier.seller ? preferredSupplier.seller.businessName : 'Unknown',
                        score: preferredSupplier.score,
                        leadTime: leadTimeDays
                    } : null,
                    supplierComparison: suppliersWithScores.map(s => ({
                        _id: s.sellerId,
                        name: s.seller ? s.seller.name : 'Unknown',
                        businessName: s.seller ? s.seller.businessName : 'Unknown',
                        price: s.purchasePrice,
                        score: s.score,
                        onTimeRate: s.onTimeRate,
                        rejectionRate: s.rejectionRate
                    }))
                });
            }
        }
    }

    // Sort by priority
    const priorityWeight = { 'CRITICAL': 4, 'HIGH': 3, 'MEDIUM': 2, 'LOW': 1 };
    suggestions.sort((a, b) => priorityWeight[b.priority] - priorityWeight[a.priority]);

    return {
        summary,
        suggestions
    };
};
