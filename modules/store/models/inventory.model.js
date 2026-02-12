import mongoose from "mongoose";

const inventorySchema = new mongoose.Schema({
    store: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Store',
        required: [true, 'Store reference is required'],
        index: true
    },
    
    product: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
        required: [true, 'Product reference is required'],
        index: true
    },
    
    quantity: {
        type: Number,
        required: [true, 'Quantity is required'],
        min: [0, 'Quantity cannot be negative'],
        default: 0
    },
    
    minStockLevel: {
        type: Number,
        min: [0, 'Minimum stock level cannot be negative'],
        default: 10
    },
    
    sellingPrice: {
        type: Number,
        required: [true, 'Selling price is required'],
        min: [0, 'Selling price cannot be negative']
    },
    
    isActive: {
        type: Boolean,
        default: true,
        index: true
    },
    
    isLowStock: {
        type: Boolean,
        default: false,
        index: true
    },
    
    isOutOfStock: {
        type: Boolean,
        default: false,
        index: true
    }
}, {
    timestamps: true
});

inventorySchema.index({ store: 1, product: 1 }, { unique: true });
inventorySchema.index({ store: 1, isActive: 1 });
inventorySchema.index({ product: 1, isActive: 1 });
inventorySchema.index({ store: 1, isLowStock: 1 });
inventorySchema.index({ store: 1, isOutOfStock: 1 });

inventorySchema.pre('save', function(next) {
    this.isOutOfStock = this.quantity === 0;
    this.isLowStock = !this.isOutOfStock && this.quantity <= this.minStockLevel;
    next();
});

inventorySchema.methods.updateStock = function(quantity, operation = 'add') {
    if (operation === 'add') {
        this.quantity += quantity;
    } else if (operation === 'subtract') {
        this.quantity = Math.max(0, this.quantity - quantity);
    } else if (operation === 'set') {
        this.quantity = quantity;
    }
    return this.quantity;
};

inventorySchema.statics.findLowStock = function(storeId) {
    return this.find({
        store: storeId,
        isActive: true,
        isLowStock: true
    }).populate('product');
};

inventorySchema.statics.findOutOfStock = function(storeId) {
    return this.find({
        store: storeId,
        isActive: true,
        isOutOfStock: true
    }).populate('product');
};

const Inventory = mongoose.model("Inventory", inventorySchema);

export default Inventory;
