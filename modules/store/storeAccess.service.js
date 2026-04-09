import { Cart, Store } from "../../models/index.js";
import { ApiError } from "../../utils/ApiError.js";

export const assertStoreOwner = async (storeId, userId) => {
  const store = await Store.findOne({
    _id: storeId,
    owner: userId,
    isActive: true,
  });

  if (!store) {
    throw new ApiError("Store not found or access denied", 404);
  }

  return store;
};

export const assertCartAccess = async (cartId, userId, populate = "") => {
  const query = Cart.findById(cartId);

  if (populate) {
    query.populate(populate);
  }

  const cart = await query;

  if (!cart) {
    throw new ApiError("Cart not found", 404);
  }

  await assertStoreOwner(cart.store, userId);
  return cart;
};
