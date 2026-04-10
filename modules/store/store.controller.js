import * as storeService from "./store.service.js";
const { createStore, getStore, updateStore, deleteStore, getUserStores } = storeService;
import { Employee } from "../../models/index.js";
import { ALL_PERMISSIONS } from "../../utils/permissions.js";
import { seedSystemRoles } from "../role/role.service.js";
import { ApiResponse } from "../../utils/ApiResponse.js";

//create store controller
export const storeCreateController = async (req, res) => {
    try {
        // Additional safety check (though requireUser middleware should handle this)
        if (!req.user || !req.user._id) {
            return res.status(403).json(
                new ApiResponse(null, "User not found. Please complete registration first.", 403)
            );
        }

        const storeData = {
            ...req.body,
            owner: req.user._id,
            ownerFirebaseUid: req.user.firebaseUid
        };

        const store = await createStore(storeData);

        // Auto-seed system roles for the new store
        await seedSystemRoles(store._id, req.user._id);

        res.status(201).json(new ApiResponse(store, "Store created successfully and system roles initialized", 201));
    } catch (error) {
        res.status(error.statusCode || 500).json(new ApiResponse(null, error.message, error.statusCode || 500));
    }
};

//get all user stores controller (Owned + Invited)
export const storeGetAllController = async (req, res) => {
    try {
        if (!req.user || !req.user._id) {
            return res.status(403).json(
                new ApiResponse(null, "User not found. Please complete registration first.", 403)
            );
        }

        const stores = await getUserStores(req.user._id);
        res.status(200).json(new ApiResponse(stores, "Stores fetched successfully", 200));
    } catch (error) {
        res.status(error.statusCode || 500).json(new ApiResponse(null, error.message, error.statusCode || 500));
    }
};

//get store controller — now includes user role and permissions context
export const storeGetController = async (req, res) => {
    try {
        const { storeId } = req.params;
        const userId = req.user._id;

        const store = await getStore(storeId);
        
        let role = null;
        let permissions = [];

        // Determine user context for this store
        if (store.owner.toString() === userId.toString()) {
            role = "Owner";
            permissions = ALL_PERMISSIONS; // Owner has full access
        } else {
            const employee = await Employee.findOne({ 
                store: storeId, 
                user: userId, 
                status: "active" 
            }).populate("role");

            if (employee) {
                role = employee.role?.name || "Employee";
                permissions = employee.role?.permissions || [];
            } else {
                return res.status(403).json(new ApiResponse(null, "You do not have access to this store", 403));
            }
        }

        res.status(200).json(new ApiResponse({ 
            ...store.toObject(), 
            userContext: { role, permissions } 
        }, "Store fetched successfully", 200));
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
