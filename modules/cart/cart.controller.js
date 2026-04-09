import { createCart, startScanning, addItemToCart, processPayment, confirmPayment, getProductByBarcodeInCart } from "./cart.service.js";
import { ApiResponse } from "../../utils/ApiResponse.js";

export const createCartController = async (req, res) => {
    try {
        const cart = await createCart({
            ...req.body,
            user: req.user._id,
            store: req.body.storeId || req.body.store
        }, req.user._id);
        res.status(201).json(new ApiResponse(cart, "Cart created/retrieved successfully", 201));
    } catch (error) {
        res.status(error.statusCode || 500).json({
            message: error.message,
            statusCode: error.statusCode || 500
        });
    }
}

export const startScanningController = async (req, res) => {
    try {
        const { cartId } = req.params;
        const cart = await startScanning(cartId, req.user._id);
        res.status(200).json(new ApiResponse(cart, "Scanning started", 200));
    } catch (error) {
        res.status(error.statusCode || 500).json({
            message: error.message,
            statusCode: error.statusCode || 500
        });
    }
}

export const addItemController = async (req, res) => {
    try {
        const { cartId } = req.params;
        const { productId, quantity } = req.body;
        const cart = await addItemToCart(cartId, productId, quantity, req.user._id);
        res.status(200).json(new ApiResponse(cart, "Item added to cart", 200));
    } catch (error) {
        res.status(error.statusCode || 500).json({
            message: error.message,
            statusCode: error.statusCode || 500
        });
    }
}

export const processPaymentController = async (req, res) => {
    try {
        const { cartId } = req.params;
        const { paymentId } = req.body;
        const cart = await processPayment(cartId, paymentId, req.user._id);
        res.status(200).json(new ApiResponse(cart, "Payment processed", 200));
    } catch (error) {
        res.status(error.statusCode || 500).json({
            message: error.message,
            statusCode: error.statusCode || 500
        });
    }
}

export const confirmPaymentController = async (req, res) => {
    try {
        const { cartId } = req.params;
        const result = await confirmPayment(cartId, req.user._id);
        res.status(200).json(new ApiResponse(result, "Payment confirmed and order completed", 200));
    } catch (error) {
        res.status(error.statusCode || 500).json({
            message: error.message,
            statusCode: error.statusCode || 500
        });
    }
}

export const getProductByBarcodeController = async (req, res) => {
    try {
        const { cartId, barcode } = req.params;
        const product = await getProductByBarcodeInCart(cartId, barcode, req.user._id);
        res.status(200).json(new ApiResponse(product, "Product found", 200));
    } catch (error) {
        res.status(error.statusCode || 500).json({
            message: error.message,
            statusCode: error.statusCode || 500
        });
    }
}
