import { Cart, Store, Employee } from "../../models/index.js";
import { ApiError } from "../../utils/ApiError.js";

export const assertStoreOwner = async (storeId, userId) => {
  const store = await Store.findOne({
    _id: storeId,
    isActive: true,
  });

  if (!store) {
    throw new ApiError("Store not found", 404);
  }

  if (store.owner.toString() === userId.toString()) {
    return store;
  }

  const employee = await Employee.findOne({
    store: storeId,
    user: userId,
    status: "active",
  });

  if (employee) {
    return store;
  }

  throw new ApiError("Store not found or access denied", 403);
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
