import mongoose from "mongoose";

const productSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Product name is required'],
        trim: true,
        index: true
    },

    brand: {
        type: String,
        trim: true,
        default: null
    },
    
    barcode: {
        type: String,
        sparse: true,
        trim: true
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

    unit: {
        type: String,
        default: 'Pieces',
        trim: true
    },

    expDate: {
        type: Date
    },

    image: {
        type: String,
        trim: true,
        default: null
    },

    source: {
        type: String,
        trim: true,
        default: null
    },

    confidence: {
        type: Number,
        min: 0,
        max: 1,
        default: null
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
// Unique barcode per store, but ONLY if barcode is provided (handles multiple null/empty barcodes)
productSchema.index(
    { store: 1, barcode: 1 }, 
    { 
        unique: true, 
        partialFilterExpression: { barcode: { $type: "string", $gt: "" } } 
    }
);
productSchema.index({ store: 1, name: 1 }, { unique: true });
productSchema.index({ store: 1, isActive: 1 });
productSchema.index({ store: 1, category: 1 });

const Product = mongoose.model("Product", productSchema);

export default Product;
