import mongoose from "mongoose";

const storeSchema = new mongoose.Schema({
    name: { 
        type: String, 
        required: true 
    },
    owner: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User', 
        required: true 
    },
    ownerFirebaseUid: { 
        type: String, 
        required: true 
    },
    address: { 
        type: String, 
        required: true 
    },
    phone: { 
        type: String, 
        required: true 
    },
    email: { 
        type: String 
    },
    settings: {
        lowStockThreshold: { 
            type: Number, 
            default: 10 
        },
        expiryAlertDays: { 
            type: Number, 
            default: 7 
        },
        currency: { 
            type: String, 
            default: 'INR' 
        },
    },
    isActive: { 
        type: Boolean, 
        default: true 
    },
    createdAt: { 
        type: Date, 
        default: Date.now 
    },
    updatedAt: { 
        type: Date, 
        default: Date.now 
    },
}, {
    timestamps: true
});

storeSchema.index({ owner: 1 });
storeSchema.index({ ownerFirebaseUid: 1 });

const Store = mongoose.model("Store", storeSchema);

export default Store;
