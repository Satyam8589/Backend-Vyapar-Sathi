import * as authService from './auth.service.js';


export const register = async (req, res) => {
    try {
        const user = await authService.register(req.firebaseUser);

        return res.status(201).json({
            success: true,
            message: "User registered successfully",
            user: authService.formatUserResponse(user)
        });

    } catch (error) {

        if (error.message.includes('already exists')) {
            return res.status(409).json({
                success: false,
                message: "User already exists. Please login instead."
            });
        }

        return res.status(500).json({
            success: false,
            message: "Failed to register user",
            error: error.message
        });
    }
};

export const login = async (req, res) => {
    try {
        const user = await authService.login(req.firebaseUser);

        return res.status(200).json({
            success: true,
            message: "User logged in successfully",
            user: authService.formatUserResponse(user)
        });

    } catch (error) {

        if (error.message.includes('not found')) {
            return res.status(404).json({
                success: false,
                message: "User not found. Please register first."
            });
        }

        return res.status(500).json({
            success: false,
            message: "Failed to login user",
            error: error.message
        });
    }
};

export const getUserProfile = async (req, res) => {
    try {
        const firebaseUid = req.firebaseUser?.uid || req.user?.firebaseUid || req.user?.uid;
        if (!firebaseUid) {
            return res.status(401).json({
                success: false,
                message: "Unauthorized: Missing user credentials"
            });
        }

        const user = await authService.getUserByFirebaseUid(firebaseUid);

        return res.status(200).json({
            success: true,
            user: authService.formatUserResponse(user)
        });

    } catch (error) {
        
        if (error.message === 'User not found') {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        return res.status(500).json({
            success: false,
            message: "Failed to get user profile",
            error: error.message
        });
    }
};

export const updateUserProfile = async (req, res) => {
    try {
        const firebaseUid = req.firebaseUser?.uid || req.user?.firebaseUid || req.user?.uid;
        if (!firebaseUid) {
            return res.status(401).json({
                success: false,
                message: "Unauthorized: Missing user credentials"
            });
        }

        const { name, phone, preferences, profilePicture } = req.body;
        const updatedUser = await authService.updateUserProfile(firebaseUid, {
            name,
            phone,
            preferences,
            profilePicture
        });

        return res.status(200).json({
            success: true,
            message: "User profile updated successfully",
            user: authService.formatUserResponse(updatedUser)
        });
    } catch (error) {
        if (error.message === 'User not found') {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        return res.status(500).json({
            success: false,
            message: "Failed to update user profile",
            error: error.message
        });
    }
};
