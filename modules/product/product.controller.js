import { addProduct, getProductById, updateProductById, deleteProductById, getAllProducts, getProductByBarcode, getMasterProduct, saveMasterProduct } from "./product.service.js";
import { resolveBarcode } from "./resolver.service.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { uploadBufferToCloudinary } from "../../utils/cloudinary.js";

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

// Resolve a product globally by barcode (public, no auth required)
// GET /api/products/resolve/:barcode
export const resolveProduct = async (req, res) => {
    try {
        const { barcode } = req.params;

        const result = await resolveBarcode(barcode);

        if (!result) {
            return res.status(404).json({
                success: false,
                message: "Product not found for this barcode.",
            });
        }

        return res.status(200).json({
            success: true,
            data: result,
        });
    } catch (error) {
        return res.status(400).json({
            success: false,
            message: error.message,
        });
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

// Upload a product image to Cloudinary
export const uploadProductImageController = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json(new ApiResponse(null, "Image file is required", 400));
        }

        const uploaded = await uploadBufferToCloudinary(req.file.buffer, {
            folder: "vyapar-sathi/products",
            resource_type: "image",
        });

        return res.status(200).json(
            new ApiResponse(
                {
                    imageUrl: uploaded.secure_url,
                    publicId: uploaded.public_id,
                },
                "Image uploaded successfully",
                200,
            ),
        );
    } catch (error) {
        return res.status(error.statusCode || 500).json(
            new ApiResponse(null, error.message || "Failed to upload image", error.statusCode || 500),
        );
    }
};

// GET /api/product/master/:barcode
// Fetch a product from the global MasterProduct catalog (no external API call)
export const getMasterProductController = async (req, res) => {
    try {
        const { barcode } = req.params;
        const product = await getMasterProduct(barcode);

        if (!product) {
            return res.status(404).json(new ApiResponse(null, "Not found in master catalog", 404));
        }

        return res.status(200).json(new ApiResponse(product, "Found in master catalog", 200));
    } catch (error) {
        return res.status(error.statusCode || 500).json(new ApiResponse(null, error.message, error.statusCode || 500));
    }
};

// POST /api/product/master
// Save a product to the global MasterProduct catalog (idempotent — skips if barcode exists)
export const saveMasterProductController = async (req, res) => {
    try {
        const result = await saveMasterProduct(req.body);

        if (!result.saved) {
            // Already in master catalog — return existing record
            return res.status(200).json(new ApiResponse(result.product, "Already exists in master catalog", 200));
        }

        return res.status(201).json(new ApiResponse(result.product, "Saved to master catalog", 201));
    } catch (error) {
        return res.status(error.statusCode || 500).json(new ApiResponse(null, error.message, error.statusCode || 500));
    }
};