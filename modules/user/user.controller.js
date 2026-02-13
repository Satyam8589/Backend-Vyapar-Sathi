import { getUserById } from "./user.service.js";
import { ApiResponse } from "../../utils/ApiResponse.js";

export const getUserController = async (req, res) => {
    try {
        const user = await getUserById(req.params.id);
        res.status(200).json(new ApiResponse(user, "User fetched successfully", 200));
    } catch (error) {
        res.status(error.statusCode || 500).json(new ApiResponse(null, error.message, error.statusCode || 500));
    }
};