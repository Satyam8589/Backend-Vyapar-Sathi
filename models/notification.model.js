import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema({
    store: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Store',
        required: [true, 'Store reference is required'],
        index: true
    },
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        index: true
    },
    type: {
        type: String,
        enum: [
            'LOW_STOCK', 
            'OUT_OF_STOCK', 
            'REORDER_ALERT', 
            'PURCHASE_DUE', 
            'PURCHASE_CREATED', 
            'PURCHASE_UPDATED', 
            'PURCHASE_RETURNED', 
            'PURCHASE_ORDER_PENDING',
            'PURCHASE_ORDER_OVERDUE',
            'SALE_CREATED',
            'GRN_CREATED',
            'PAYMENT_RECEIVED',
            'SYSTEM_ERROR'
        ],
        required: true,
        index: true
    },
    title: {
        type: String,
        required: true,
        trim: true
    },
    message: {
        type: String,
        required: true,
        trim: true
    },
    relatedEntityType: {
        type: String,
        enum: ['Product', 'Purchase', 'PurchaseReturn', 'PurchaseOrder', 'Inventory', 'Sale', 'GRN', null],
        default: null
    },
    relatedEntityId: {
        type: mongoose.Schema.Types.ObjectId,
        default: null,
        index: true
    },
    isRead: {
        type: Boolean,
        default: false,
        index: true
    },
    priority: {
        type: String,
        enum: ['HIGH', 'MEDIUM', 'LOW'],
        default: 'LOW'
    }
}, {
    timestamps: true
});

notificationSchema.index({ store: 1, isRead: 1 });
notificationSchema.index({ store: 1, createdAt: -1 });

const Notification = mongoose.model("Notification", notificationSchema);

export default Notification;
