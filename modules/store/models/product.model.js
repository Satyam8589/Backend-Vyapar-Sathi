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
        sparse: true,
        trim: true,
        index: true
    },
    
    category: {
        type: String,
        required: [true, 'Product category is required'],
        trim: true
    },
    
    price: {
        type: Number,
        required: [true, 'Price is required'],
        min: [0, 'Price cannot be negative']
    },
    
    quantity: {
        type: Number,
        required: [true, 'Quantity is required'],
        min: [0, 'Quantity cannot be negative'],
        default: 0
    },
    
    store: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Store',
        required: [true, 'Store reference is required'],
        index: true
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

productSchema.index({ name: 'text' });
productSchema.index({ store: 1, barcode: 1 });
productSchema.index({ store: 1, isActive: 1 });
productSchema.index({ store: 1, category: 1 });

const Product = mongoose.model("Product", productSchema);

export default Product;
