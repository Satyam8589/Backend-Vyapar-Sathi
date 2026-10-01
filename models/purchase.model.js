import mongoose from "mongoose";

const purchaseItemSchema = new mongoose.Schema({
    product: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
        required: [true, 'Product reference is required']
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
    discount: {
        type: Number,
        default: 0,
        min: [0, 'Discount cannot be negative']
    },
    tax: {
        type: Number,
        default: 0,
        min: [0, 'Tax cannot be negative']
    },
    subtotal: {
        type: Number,
        required: true,
        min: [0, 'Subtotal cannot be negative']
    }
}, { _id: false });

const purchaseSchema = new mongoose.Schema({
    store: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Store',
        required: [true, 'Store reference is required'],
        index: true
    },
    seller: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Seller',
        required: [true, 'Seller reference is required'],
        index: true
    },
    invoiceNumber: {
        type: String,
        trim: true,
        required: [true, 'Invoice number is required']
    },
    purchaseDate: {
        type: Date,
        default: Date.now,
        required: true
    },
    items: {
        type: [purchaseItemSchema],
        required: true,
        validate: [v => v.length > 0, 'Purchase must have at least one item']
    },
    subtotal: {
        type: Number,
        required: true,
        min: 0
    },
    discount: {
        type: Number,
        default: 0,
        min: 0
    },
    tax: {
        type: Number,
        default: 0,
        min: 0
    },
    grandTotal: {
        type: Number,
        required: true,
        min: 0
    },
    paidAmount: {
        type: Number,
        default: 0,
        min: 0
    },
    dueAmount: {
        type: Number,
        default: 0,
        min: 0
    },
    paymentStatus: {
        type: String,
        enum: ['paid', 'partial', 'unpaid'],
        default: 'unpaid',
        index: true
    },
    notes: {
        type: String,
        trim: true
    }
}, {
    timestamps: true
});

purchaseSchema.index({ store: 1, invoiceNumber: 1 }, { unique: true });
purchaseSchema.index({ store: 1, purchaseDate: -1 });

purchaseSchema.pre('save', function(next) {
    if (this.paidAmount >= this.grandTotal) {
        this.paymentStatus = 'paid';
    } else if (this.paidAmount > 0) {
        this.paymentStatus = 'partial';
    } else {
        this.paymentStatus = 'unpaid';
    }
    
    // Automatically calculate due amount
    this.dueAmount = Math.max(0, this.grandTotal - this.paidAmount);
    
    next();
});

const Purchase = mongoose.model("Purchase", purchaseSchema);

export default Purchase;
