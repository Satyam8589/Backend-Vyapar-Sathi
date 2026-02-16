import { Cart } from '../../models/index.js';
import { Product } from '../../models/index.js';
import { ApiError } from "../../utils/ApiError.js";

export const createCart = async (cartData) => {
    try {
        if (!cartData.user || !cartData.store) {
            throw new ApiError(400, "User and Store references are required");
        }

        let cart = await Cart.findOne({
            user: cartData.user,
            store: cartData.store,
            status: { $in: ['open', 'scanning'] }
        });

        if (cart) {
            return cart;
        }

        cart = await Cart.create(cartData);
        if (!cart) {
            throw new ApiError(400, "Failed to create cart");
        }
        return cart;
    } catch (error) {
        throw error;
    }
}

export const startScanning = async (cartId) => {
    const cart = await Cart.findByIdAndUpdate(
        cartId,
        { status: 'scanning' },
        { new: true }
    );
    if (!cart) throw new ApiError(404, "Cart not found");
    return cart;
};

export const addItemToCart = async (cartId, productId, quantity = 1) => {
    const cart = await Cart.findById(cartId);
    if (!cart) throw new ApiError(404, "Cart not found");
    if (cart.status !== 'scanning' && cart.status !== 'open') {
        throw new ApiError(400, "Cannot add items to cart in current status");
    }

    const product = await Product.findById(productId);
    if (!product) throw new ApiError(404, "Product not found");
    if (product.quantity < quantity) throw new ApiError(400, "Insufficient stock");

    const itemIndex = cart.products.findIndex(p => p.product.toString() === productId);

    if (itemIndex > -1) {
        cart.products[itemIndex].quantity += quantity;
    } else {
        cart.products.push({
            product: productId,
            quantity,
            price: product.price
        });
    }

    // Recalculate total price
    cart.totalPrice = cart.products.reduce((acc, curr) => acc + (curr.price * curr.quantity), 0);
    
    await cart.save();
    return cart;
};

export const processPayment = async (cartId, paymentId) => {
    const cart = await Cart.findById(cartId);
    if (!cart) throw new ApiError(404, "Cart not found");

    cart.paymentId = paymentId;
    cart.paymentStatus = 'paid';
    cart.status = 'payment_pending'; // Waiting for owner confirmation
    
    await cart.save();
    return cart;
};

export const confirmPayment = async (cartId) => {
    const cart = await Cart.findById(cartId);
    if (!cart) throw new ApiError(404, "Cart not found");
    
    if (cart.paymentStatus !== 'paid') {
        throw new ApiError(400, "Payment hasn't been made yet");
    }

    cart.status = 'completed';
    await cart.save();
    
    // Here we should also update product inventory
    for (const item of cart.products) {
        await Product.findByIdAndUpdate(item.product, {
            $inc: { quantity: -item.quantity }
        });
    }

    return cart;
};

export const getProductByBarcodeInCart = async (cartId, barcode) => {
    const cart = await Cart.findById(cartId);
    if (!cart) throw new ApiError(404, "Cart not found");

    const product = await Product.findOne({
        store: cart.store,
        barcode: barcode,
        isActive: true
    });

    if (!product) {
        throw new ApiError(404, "Product not found in this store with this barcode");
    }

    return product;
};

