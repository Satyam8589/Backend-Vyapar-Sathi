import mongoose from "mongoose";

const grnItemSchema = new mongoose.Schema({
    product: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
        required: [true, 'Product reference is required']
    },
    orderedQuantity: {
        type: Number,
        required: [true, 'Ordered quantity is required'],
        min: [0, 'Ordered quantity cannot be negative']
    },
    previouslyReceivedQuantity: {
        type: Number,
        default: 0,
        min: [0, 'Previously received quantity cannot be negative']
    },
    receivedQuantity: {
        type: Number,
        required: [true, 'Received quantity is required'],
        min: [0, 'Received quantity cannot be negative']
    },
    rejectedQuantity: {
        type: Number,
        default: 0,
        min: [0, 'Rejected quantity cannot be negative']
    },
    acceptedQuantity: {
        type: Number,
        required: [true, 'Accepted quantity is required'],
        min: [0, 'Accepted quantity cannot be negative']
    },
    purchasePrice: {
        type: Number,
        required: [true, 'Purchase price is required'],
        min: [0, 'Purchase price cannot be negative']
    },
    total: {
        type: Number,
        required: true,
        min: [0, 'Total cannot be negative']
    }
}, { _id: false });

const grnSchema = new mongoose.Schema({
    store: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Store',
        required: [true, 'Store reference is required'],
        index: true
    },
    purchaseOrder: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'PurchaseOrder',
        required: [true, 'Purchase Order reference is required'],
        index: true
    },
    seller: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Seller',
        required: [true, 'Seller reference is required'],
        index: true
    },
    grnNumber: {
        type: String,
        trim: true,
        required: [true, 'GRN number is required']
    },
    receivedDate: {
        type: Date,
        default: Date.now,
        required: true
    },
    items: {
        type: [grnItemSchema],
        required: true,
        validate: [v => v.length > 0, 'GRN must have at least one item']
    },
    notes: {
        type: String,
        trim: true
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    status: {
        type: String,
        enum: ['Completed'],
        default: 'Completed'
    },
    linkedPurchase: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Purchase'
    }
}, {
    timestamps: true
});

grnSchema.index({ store: 1, grnNumber: 1 }, { unique: true });
grnSchema.index({ store: 1, receivedDate: -1 });

const GRN = mongoose.model("GRN", grnSchema);

export default GRN;
