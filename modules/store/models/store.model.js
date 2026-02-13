import mongoose from "mongoose";

const storeSchema = new mongoose.Schema({
    name: { 
        type: String, 
        required: [true, 'Store name is required'],
        trim: true,
        maxlength: [100, 'Store name cannot exceed 100 characters']
    },
    
    owner: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User', 
        required: [true, 'Store owner is required'],
        index: true
    },
    ownerFirebaseUid: { 
        type: String, 
        required: [true, 'Owner Firebase UID is required'],
        index: true
    },
    
    address: {
        street: { type: String, trim: true },
        city: { type: String, trim: true },
        state: { type: String, trim: true },
        pincode: { type: String, trim: true },
        country: { type: String, default: 'India', trim: true },
        fullAddress: { type: String, required: true, trim: true }
    },
    phone: { 
        type: String, 
        required: [true, 'Phone number is required'],
        trim: true,
        validate: {
            validator: function(v) {
                return /^[0-9]{10}$/.test(v);
            },
            message: 'Please provide a valid 10-digit phone number'
        }
    },
    email: { 
        type: String,
        trim: true,
        lowercase: true,
        validate: {
            validator: function(v) {
                return !v || /^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/.test(v);
            },
            message: 'Please provide a valid email address'
        }
    },
    
    businessType: {
        type: String,
        enum: ['retail', 'wholesale', 'both', 'service', 'other'],
        default: 'retail'
    },
    
    settings: {
        lowStockThreshold: { 
            type: Number, 
            default: 10,
            min: [0, 'Low stock threshold cannot be negative']
        },
        expiryAlertDays: { 
            type: Number, 
            default: 7,
            min: [0, 'Expiry alert days cannot be negative']
        },
        currency: { 
            type: String, 
            default: 'INR',
            enum: ['INR', 'USD', 'EUR', 'GBP']
        }
    },
    
    isActive: { 
        type: Boolean, 
        default: true,
        index: true
    },
    
    description: {
        type: String,
        trim: true,
        maxlength: [500, 'Description cannot exceed 500 characters']
    },
    logo: {
        type: String,
        trim: true
    }
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});


storeSchema.index({ owner: 1, isActive: 1 });
storeSchema.index({ ownerFirebaseUid: 1, isActive: 1 });
storeSchema.index({ name: 'text', description: 'text' });

storeSchema.virtual('inventoryCount', {
    ref: 'Inventory',
    localField: '_id',
    foreignField: 'store',
    count: true
});


storeSchema.pre('save', async function() {
    this.updatedAt = Date.now();
});

storeSchema.methods.isOwnedBy = function(userId) {
    return this.owner.toString() === userId.toString();
};

storeSchema.statics.findByOwner = function(ownerId) {
    return this.find({ owner: ownerId, isActive: true });
};

const Store = mongoose.model("Store", storeSchema);

export default Store;
