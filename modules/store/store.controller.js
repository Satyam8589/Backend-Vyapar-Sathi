import { createStore, getStore, updateStore, deleteStore, getStoresByOwner } from "./store.service.js";
import { ApiResponse } from "../../utils/ApiResponse.js";

//create store controller
export const storeCreateController = async (req, res) => {
    try {
        const storeData = {
            ...req.body,
            owner: req.user._id,
            ownerFirebaseUid: req.user.firebaseUid
        };

        const store = await createStore(storeData);
        res.status(201).json(new ApiResponse(store, "Store created successfully", 201));
    } catch (error) {
        res.status(error.statusCode || 500).json(new ApiResponse(null, error.message, error.statusCode || 500));
    }
};

//get all user stores controller
export const storeGetAllController = async (req, res) => {
    try {
        const stores = await getStoresByOwner(req.user._id);
        res.status(200).json(new ApiResponse(stores, "Stores fetched successfully", 200));
    } catch (error) {
        res.status(error.statusCode || 500).json(new ApiResponse(null, error.message, error.statusCode || 500));
    }
};

//get store controller
export const storeGetController = async (req, res) => {
    try {
        const store = await getStore(req.params.storeId);
        res.status(200).json(new ApiResponse(store, "Store fetched successfully", 200));
    } catch (error) {
        res.status(error.statusCode || 500).json(new ApiResponse(null, error.message, error.statusCode || 500));
    }
};

//update store controller
export const storeUpdateController = async (req, res) => {
    try {
        const store = await updateStore(req.params.storeId, req.body);
        res.status(200).json(new ApiResponse(store, "Store updated successfully", 200));
    } catch (error) {
        res.status(error.statusCode || 500).json(new ApiResponse(null, error.message, error.statusCode || 500));
    }
};

//delete store controller
export const storeDeleteController = async (req, res) => {
    try {
        const store = await deleteStore(req.params.storeId);
        res.status(200).json(new ApiResponse(store, "Store deleted successfully", 200));
    } catch (error) {
        res.status(error.statusCode || 500).json(new ApiResponse(null, error.message, error.statusCode || 500));
    }
};
