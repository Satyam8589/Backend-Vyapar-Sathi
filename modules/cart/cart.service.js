import { Cart } from '../../models/index.js';
import { Product } from '../../models/index.js';
import { ApiError } from "../../utils/ApiError.js";
import { assertCartAccess, assertStoreOwner } from "../store/storeAccess.service.js";
import { materializeSaleFromCart } from "../sale/sale.service.js";

export const createCart = async (cartData, userId) => {
    try {
        if (!cartData.user || !cartData.store) {
            throw new ApiError(400, "User and Store references are required");
        }

        await assertStoreOwner(cartData.store, userId);

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

export const startScanning = async (cartId, userId) => {
    await assertCartAccess(cartId, userId);

    const cart = await Cart.findByIdAndUpdate(
        cartId,
        { status: 'scanning' },
        { new: true }
    );
    if (!cart) throw new ApiError(404, "Cart not found");
    return cart;
};

export const addItemToCart = async (cartId, productId, quantity = 1, userId) => {
    const cart = await assertCartAccess(cartId, userId);
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

export const processPayment = async (cartId, paymentId, userId) => {
    const cart = await assertCartAccess(cartId, userId);

    cart.paymentId = paymentId;
    cart.paymentStatus = 'paid';
    cart.status = 'payment_pending'; // Waiting for owner confirmation
    
    await cart.save();
    return cart;
};

export const confirmPayment = async (cartId, userId) => {
    return materializeSaleFromCart(cartId, userId);
};

export const getProductByBarcodeInCart = async (cartId, barcode, userId) => {
    const cart = await assertCartAccess(cartId, userId);

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

