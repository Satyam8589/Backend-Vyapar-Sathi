import mongoose from "mongoose";

const returnItemSchema = new mongoose.Schema({
    product: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
        required: [true, 'Product reference is required']
    },
    productName: {
        // Snapshot of product name at time of return for historical accuracy
        type: String,
        trim: true,
        default: null
    },
    quantity: {
        type: Number,
        required: [true, 'Quantity is required'],
        min: [0.01, 'Quantity must be greater than 0']
    },
    purchasePrice: {
        type: Number,
        required: [true, 'Purchase price is required'],
        min: [0, 'Purchase price cannot be negative']
    },
    returnAmount: {
        type: Number,
        required: true,
        min: [0, 'Return amount cannot be negative']
    }
}, { _id: false });

const purchaseReturnSchema = new mongoose.Schema({
    store: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Store',
        required: [true, 'Store reference is required'],
        index: true
    },
    purchase: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Purchase',
        required: [true, 'Purchase reference is required'],
        index: true
    },
    seller: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Seller',
        required: [true, 'Seller reference is required'],
        index: true
    },
    returnDate: {
        type: Date,
        default: Date.now,
        required: true
    },
    items: {
        type: [returnItemSchema],
        required: true,
        validate: [v => v.length > 0, 'Return must have at least one item']
    },
    totalReturnAmount: {
        type: Number,
        required: true,
        min: 0
    },
    reason: {
        type: String,
        required: [true, 'Return reason is required'],
        enum: [
            'Damaged Product',
            'Defective Product',
            'Wrong Product',
            'Expired Product',
            'Excess Quantity',
            'Supplier Issue',
            'Other'
        ]
    },
    notes: {
        type: String,
        trim: true
    }
}, {
    timestamps: true
});

// Compound indexes for efficient per-store return queries
purchaseReturnSchema.index({ store: 1, returnDate: -1 });
purchaseReturnSchema.index({ store: 1, purchase: 1 });

const PurchaseReturn = mongoose.model("PurchaseReturn", purchaseReturnSchema);

export default PurchaseReturn;
