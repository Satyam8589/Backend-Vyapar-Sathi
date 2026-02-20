import mongoose from "mongoose";

const masterProductSchema = new mongoose.Schema(
    {
        barcode: {
            type: String,
            required: [true, "Barcode is required"],
            unique: true,
            trim: true,
            index: true,
        },

        name: {
            type: String,
            trim: true,
            default: null,
        },

        brand: {
            type: String,
            trim: true,
            default: null,
        },

        quantity: {
            type: String,
            trim: true,
            default: null,
        },

        category: {
            type: String,
            trim: true,
            default: null,
        },

        image: {
            type: String,
            trim: true,
            default: null,
        },

        source: {
            type: String,
            trim: true,
            default: null,
        },

        confidence: {
            type: Number,
            min: 0,
            max: 1,
            default: 0.3,
        },

        resolvedAt: {
            type: Date,
            default: Date.now,
        },
    },
    {
        timestamps: true,
    }
);

const MasterProduct = mongoose.model("MasterProduct", masterProductSchema);

export default MasterProduct;
