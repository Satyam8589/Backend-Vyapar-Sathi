import mongoose from "mongoose";

const sellerSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Seller name is required'],
        trim: true
    },
    businessName: {
        type: String,
        trim: true
    },
    phone: {
        type: String,
        required: [true, 'Phone number is required'],
        trim: true
    },
    email: {
        type: String,
        trim: true,
        lowercase: true
    },
    address: {
        type: String,
        trim: true
    },
    GSTIN: {
        type: String,
        trim: true
    },
    store: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Store',
        required: [true, 'Store reference is required'],
        index: true
    },
    totalPurchase: {
        type: Number,
        default: 0
    },
    totalPaid: {
        type: Number,
        default: 0
    },
    totalDue: {
        type: Number,
        default: 0
    },
    status: {
        type: String,
        enum: ['active', 'inactive'],
        default: 'active',
        index: true
    }
}, {
    timestamps: true
});

// Indexes for faster querying
sellerSchema.index({ store: 1, name: 1 });
sellerSchema.index({ store: 1, status: 1 });
sellerSchema.index({ store: 1, phone: 1 });

const Seller = mongoose.model("Seller", sellerSchema);

export default Seller;
