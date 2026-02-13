import { createStore } from "./store.service.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { getStore } from "./store.service.js";
import { updateStore } from "./store.service.js";
import { deleteStore } from "./store.service.js";
import User from "../user/user.model.js";

//create store controller
export const storeCreateController = async (req, res) => {
    try {
        
        const user = await User.findOne({ firebaseUid: req.user.uid });
        
        if (!user) {
            return res.status(404).json(new ApiResponse(null, "User not found. Please register first.", 404));
        }

        const storeData = {
            ...req.body,
            owner: user._id,
            ownerFirebaseUid: user.firebaseUid
        };

        const store = await createStore(storeData);
        
        res.status(201).json(new ApiResponse(store, "Store created successfully", 201));
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
