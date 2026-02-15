import { Product } from '../../models/index.js';
import { ApiError } from "../../utils/ApiError.js";

//create product service
export const addProduct = async (productData) => {
    try {
        if (!productData.name || !productData.category || !productData.price) {
            throw new ApiError("Name, category, and price are required", 400);
        }

        if (!productData.store) {
            throw new ApiError("Store reference is required", 400);
        }

        if (!productData.createdBy) {
            throw new ApiError("CreatedBy (user) reference is required", 400);
        }

        const product = await Product.create(productData);
        return product;
    } catch (error) {
        throw error;
    }
};

//get product by id service
export const getProductById = async (productId) => {
    try {
        const product = await Product.findById(productId);
        if (!product) {
            throw new ApiError("Product not found", 404);
        }
        return product;
    } catch (error) {
        throw error;
    }
};

//update product by id service
export const updateProductById = async (productId, productData) => {
    try {
        const product = await Product.findById(productId);
        if (!product) {
            throw new ApiError("Product not found", 404);
        }
        product.set(productData);
        await product.save();
        return product;
    } catch (error) {
        throw error;
    }
};

//delete product by id service
export const deleteProductById = async (productId) => {
    try {
        const product = await Product.findById(productId);
        if (!product) {
            throw new ApiError("Product not found", 404);
        }
        product.isActive = false;
        await product.save();
        return product;
    } catch (error) {
        throw error;
    }
};

//get all products service
export const getAllProducts = async (storeId) => {
    try {
        const query = storeId ? { store: storeId, isActive: true } : { isActive: true };
        const products = await Product.find(query).populate('store', 'name').populate('createdBy', 'name email');
        return products;
    } catch (error) {
        throw error;
    }
};

//get product by barcode service (for auto-fill when scanning)
export const getProductByBarcode = async (barcode, storeId) => {
    try {
        if (!barcode) {
            throw new ApiError("Barcode is required", 400);
        }

        const query = { barcode, isActive: true };
        if (storeId) {
            query.store = storeId;
        }

        const product = await Product.findOne(query).populate('store', 'name');
        return product;
    } catch (error) {
        throw error;
    }
};