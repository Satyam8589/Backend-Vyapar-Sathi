import Store from "./models/store.model.js";
import { ApiError } from "../../utils/ApiError.js";

//create store service
export const createStore = async (storeData) => {
    try {
        if (!storeData.name || !storeData.owner) {
            throw new ApiError("Store name and owner ID are required", 400);
        }

        if (!storeData.address?.fullAddress) {
            throw new ApiError("Full address is required", 400);
        }

        if (!storeData.phone) {
            throw new ApiError("Phone number is required", 400);
        }

        const existingStore = await Store.findOne({
            owner: storeData.owner,
            name: storeData.name,
            isActive: true
        });

        if (existingStore) {
            throw new ApiError("A store with this name already exists for this owner", 409);
        }

        const store = await Store.create(storeData);
        
        return store;
    } catch (error) {
        throw error;
    }
};

//get store service
export const getStore = async (storeId) => {
    try {
        const store = await Store.findById(storeId);
        if (!store) {
            throw new ApiError("Store not found", 404);
        }
        return store;
    } catch (error) {
        throw error;
    }
};

//update store service
export const updateStore = async (storeId, storeData) => {
    try {
        const store = await Store.findById(storeId);
        if (!store) {
            throw new ApiError("Store not found", 404);
        }
        store.set(storeData);
        await store.save();
        return store;
    } catch (error) {
        throw error;
    }
};

//delete store service
export const deleteStore = async (storeId) => {
    try {
        const store = await Store.findById(storeId);
        if (!store) {
            throw new ApiError("Store not found", 404);
        }
        store.isActive = false;
        await store.save();
        return store;
    } catch (error) {
        throw error;
    }
};
//get all stores for an owner service
export const getStoresByOwner = async (ownerId) => {
    try {
        const stores = await Store.find({ owner: ownerId, isActive: true });
        return stores;
    } catch (error) {
        throw error;
    }
};
