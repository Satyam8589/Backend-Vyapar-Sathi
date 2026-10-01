import mongoose from "mongoose";

const paymentSchema = new mongoose.Schema({
    store: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Store',
        required: [true, 'Store reference is required'],
        index: true
    },
    // The payment can be either to a seller (for a purchase) or from a buyer (for a sale)
    seller: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Seller',
        default: null,
        index: true
    },
    buyer: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Buyer',
        default: null,
        index: true
    },
    // Reference to the original Purchase or Sale transaction
    transaction: {
        type: mongoose.Schema.Types.ObjectId,
        refPath: 'transactionModel',
        required: [true, 'Transaction reference is required'],
        index: true
    },
    transactionModel: {
        type: String,
        required: true,
        enum: ['Purchase', 'Sale']
    },
    transactionType: {
        type: String,
        required: true,
        enum: ['payment_in', 'payment_out'] // payment_in (from buyer), payment_out (to seller)
    },
    amount: {
        type: Number,
        required: [true, 'Payment amount is required'],
        min: [0.01, 'Payment amount must be greater than 0']
    },
    paymentMethod: {
        type: String,
        required: [true, 'Payment method is required'],
        enum: ['Cash', 'UPI', 'Card', 'Bank Transfer', 'Other']
    },
    paymentDate: {
        type: Date,
        default: Date.now,
        required: true,
        index: true
    },
    referenceNumber: {
        type: String,
        trim: true,
        default: null
    },
    notes: {
        type: String,
        trim: true
    }
}, {
    timestamps: true
});

// Validate that either seller or buyer is provided, but not both
paymentSchema.pre('validate', function(next) {
    if (!this.seller && !this.buyer) {
        this.invalidate('seller', 'Either seller or buyer must be provided');
    }
    if (this.seller && this.buyer) {
        this.invalidate('seller', 'Payment cannot be linked to both a seller and a buyer');
    }
    
    // Ensure transaction type matches the associated party
    if (this.buyer && this.transactionType !== 'payment_in') {
        this.invalidate('transactionType', 'Buyer payments must be of type payment_in');
    }
    if (this.seller && this.transactionType !== 'payment_out') {
        this.invalidate('transactionType', 'Seller payments must be of type payment_out');
    }
    
    next();
});

const Payment = mongoose.model("Payment", paymentSchema);

export default Payment;
