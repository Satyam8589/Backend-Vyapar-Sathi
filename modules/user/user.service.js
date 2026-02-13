import User from "./user.model.js";
import { ApiError } from "../../utils/ApiError.js";

export const getUserById = async (userId) => {
    try {
        const user = await User.findById(userId);
        if (!user) {
            throw new ApiError("User not found", 404);
        }
        return user;
    } catch (error) {
        throw error;
    }
};