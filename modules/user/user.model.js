import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
    firebaseUid: { 
        type: String, 
        required: true, 
        unique: true 
    },
    name: { 
        type: String, 
        required: true 
    },
    email: { 
        type: String, 
        required: true, 
        unique: true 
    },
    emailVerified: { 
        type: Boolean, 
        default: false 
    },
    profilePicture: { 
        type: String, 
        default: null 
    },
    createdAt: { 
        type: Date, 
        default: Date.now 
    },
    updatedAt: { 
        type: Date, 
        default: Date.now 
    },
}, {
    timestamps: true
});

const User = mongoose.model("User", userSchema);

export default User;