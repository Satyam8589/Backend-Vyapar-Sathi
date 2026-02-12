import mongoose from "mongoose";

const productSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Product name is required'],
        trim: true,
        index: true
    },
    
    barcode: {
        type: String,
        unique: true,
        sparse: true,
        trim: true,
        index: true
    },
    
    sku: {
        type: String,
        unique: true,
        sparse: true,
        trim: true,
        uppercase: true,
        index: true
    },
    
    description: {
        type: String,
        trim: true
    },
    
    category: {
        type: String,
        required: [true, 'Product category is required'],
        trim: true,
        index: true
    },
    
    brand: {
        type: String,
        trim: true
    },
    
    unit: {
        type: String,
        enum: ['piece', 'kg', 'gram', 'liter', 'ml', 'box', 'pack', 'dozen'],
        default: 'piece'
    },
    
    basePrice: {
        type: Number,
        required: [true, 'Base price is required'],
        min: [0, 'Base price cannot be negative']
    },
    
    mrp: {
        type: Number,
        min: [0, 'MRP cannot be negative']
    },
    
    gstRate: {
        type: Number,
        min: [0, 'GST rate cannot be negative'],
        max: [100, 'GST rate cannot exceed 100%'],
        default: 0
    },
    
    hsnCode: {
        type: String,
        trim: true
    },
    
    isActive: {
        type: Boolean,
        default: true,
        index: true
    },
    
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    }
}, {
    timestamps: true
});

productSchema.index({ name: 'text', description: 'text' });
productSchema.index({ category: 1 });
productSchema.index({ createdBy: 1, isActive: 1 });

const Product = mongoose.model("Product", productSchema);

export default Product;
