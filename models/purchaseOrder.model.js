import mongoose from "mongoose";

const purchaseOrderItemSchema = new mongoose.Schema({
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
    receivedQuantity: {
        type: Number,
        default: 0,
        min: [0, 'Received quantity cannot be negative']
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

const purchaseOrderSchema = new mongoose.Schema({
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
    poNumber: {
        type: String,
        trim: true,
        required: [true, 'PO number is required']
    },
    orderDate: {
        type: Date,
        default: Date.now,
        required: true
    },
    expectedDeliveryDate: {
        type: Date
    },
    items: {
        type: [purchaseOrderItemSchema],
        required: true,
        validate: [v => v.length > 0, 'Purchase Order must have at least one item']
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
    status: {
        type: String,
        enum: ['Draft', 'Pending', 'Approved', 'Partially Received', 'Received', 'Cancelled'],
        default: 'Pending',
        index: true
    },
    notes: {
        type: String,
        trim: true
    },
    linkedPurchases: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Purchase'
    }]
}, {
    timestamps: true
});

purchaseOrderSchema.index({ store: 1, poNumber: 1 }, { unique: true });
purchaseOrderSchema.index({ store: 1, orderDate: -1 });

// Helper to update status dynamically based on received quantities
purchaseOrderSchema.methods.updateStatusBasedOnReceipts = function() {
    if (this.status === 'Cancelled' || this.status === 'Draft') return;
    
    let totalOrdered = 0;
    let totalReceived = 0;
    
    this.items.forEach(item => {
        totalOrdered += item.quantity;
        totalReceived += item.receivedQuantity;
    });

    if (totalReceived === 0) {
        if (this.status === 'Partially Received' || this.status === 'Received') {
            this.status = 'Approved'; 
        }
    } else if (totalReceived >= totalOrdered) {
        this.status = 'Received';
    } else {
        this.status = 'Partially Received';
    }
};

const PurchaseOrder = mongoose.model("PurchaseOrder", purchaseOrderSchema);

export default PurchaseOrder;
