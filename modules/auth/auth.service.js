import { User } from '../../models/index.js';

// Register a new user
export const register = async ({ uid, email, name, emailVerified, picture }) => {
    try {
        const existingUser = await User.findOne({ firebaseUid: uid });
        if (existingUser) {
            throw new Error('User already exists');
        }

        const user = await User.create({
            firebaseUid: uid,
            email: email,
            name: name || email.split('@')[0],
            emailVerified: emailVerified || false,
            profilePicture: picture || null
        });

        return user;
    } catch (error) {
        throw error;
    }
}

// Login an existing user (updates their profile data)
export const login = async ({ uid, email, name, emailVerified, picture }) => {
    try {
        const user = await User.findOne({ firebaseUid: uid });
        if (!user) {
            throw new Error('User not found');
        }

        user.emailVerified = emailVerified || user.emailVerified;
        user.profilePicture = picture || user.profilePicture;
        user.name = name || user.name;
        await user.save();

        return user;
    } catch (error) {
        throw error;
    }
}

export const getUserByFirebaseUid = async (firebaseUid) => {
    try {
        const user = await User.findOne({ firebaseUid });

        if (!user) {
            throw new Error('User not found');
        }

        return user;

    } catch (error) {
        throw error;
    }
}

export const formatUserResponse = (user) => {
    return {
        id: user._id,
        firebaseUid: user.firebaseUid,
        name: user.name,
        email: user.email,
        emailVerified: user.emailVerified,
        profilePicture: user.profilePicture,
        phone: user.phone || null,
        preferences: user.preferences || {},
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
    };
}

export const updateUserProfile = async (firebaseUid, { name, phone, preferences, profilePicture }) => {
    try {
        const user = await User.findOne({ firebaseUid });
        if (!user) {
            throw new Error('User not found');
        }

        if (name !== undefined) user.name = name;
        if (phone !== undefined) user.phone = phone;
        if (preferences !== undefined) user.preferences = { ...(user.preferences || {}), ...preferences };
        if (profilePicture !== undefined) user.profilePicture = profilePicture;
        user.updatedAt = new Date();

        await user.save();
        return user;
    } catch (error) {
        throw error;
    }
}
