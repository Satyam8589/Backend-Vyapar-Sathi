import { addProduct, getProductById, updateProductById, deleteProductById, getAllProducts, getProductByBarcode } from "./product.service.js";
import { ApiResponse } from "../../utils/ApiResponse.js";

//create product controller
export const addProductController = async (req, res) => {
    try {
        const productData = {
            ...req.body,
            store: req.body.storeId || req.body.store,
            createdBy: req.user._id
        };
        
        const product = await addProduct(productData);
        res.status(201).json(new ApiResponse(product, "Product created successfully", 201));
    } catch (error) {
        res.status(error.statusCode || 500).json(new ApiResponse(null, error.message, error.statusCode || 500));
    }
};

//get product by id controller
export const getProductController = async (req, res) => {
    try {
        const product = await getProductById(req.params.id);
        res.status(200).json(new ApiResponse(product, "Product fetched successfully", 200));
    } catch (error) {
        res.status(error.statusCode || 500).json(new ApiResponse(null, error.message, error.statusCode || 500));
    }
};

//update product by id controller
export const updateProductController = async (req, res) => {
    try {
        const product = await updateProductById(req.params.id, req.body);
        res.status(200).json(new ApiResponse(product, "Product updated successfully", 200));
    } catch (error) {
        res.status(error.statusCode || 500).json(new ApiResponse(null, error.message, error.statusCode || 500));
    }
};

//delete product by id controller
export const deleteProductController = async (req, res) => {
    try {
        const product = await deleteProductById(req.params.id);
        res.status(200).json(new ApiResponse(product, "Product deleted successfully", 200));
    } catch (error) {
        res.status(error.statusCode || 500).json(new ApiResponse(null, error.message, error.statusCode || 500));
    }
};

//get all products controller
export const getAllProductsController = async (req, res) => {
    try {
        const storeId = req.query.storeId;
        const products = await getAllProducts(storeId);
        res.status(200).json(new ApiResponse(products, "Products fetched successfully", 200));
    } catch (error) {
        res.status(error.statusCode || 500).json(new ApiResponse(null, error.message, error.statusCode || 500));
    }
};

//get product by barcode controller (for auto-fill)
export const getProductByBarcodeController = async (req, res) => {
    try {
        const { barcode } = req.params;
        const storeId = req.query.storeId;
        const product = await getProductByBarcode(barcode, storeId);
        
        if (!product) {
            return res.status(404).json(new ApiResponse(null, "Product not found with this barcode", 404));
        }
        
        res.status(200).json(new ApiResponse(product, "Product found", 200));
    } catch (error) {
        res.status(error.statusCode || 500).json(new ApiResponse(null, error.message, error.statusCode || 500));
    }
};