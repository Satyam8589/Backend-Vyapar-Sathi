import { auth } from '../config/firebase.js';
import * as authService from '../modules/auth/auth.service.js';

const authMiddleware = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ 
                success: false,
                message: "Unauthorized - No token provided" 
            });
        }

        const token = authHeader.split('Bearer ')[1];

        if (!token) {
            return res.status(401).json({ 
                success: false,
                message: "Unauthorized - Invalid token format" 
            });
        }

        const decodedToken = await auth.verifyIdToken(token);

        // Store Firebase info separately
        req.firebaseUser = {
            uid: decodedToken.uid,
            email: decodedToken.email,
            name: decodedToken.name,
            emailVerified: decodedToken.email_verified,
            picture: decodedToken.picture
        };

        // Try to find user in database
        let user = null;
        try {
            user = await authService.getUserByFirebaseUid(decodedToken.uid);
        } catch (e) {
            // User not found in DB, this is fine for register route
            user = null;
        }
        
        // This will be null if user hasn't registered yet
        req.user = user;
        
        next();

    } catch (error) {

        if (error.code === 'auth/id-token-expired') {
            return res.status(401).json({ 
                success: false,
                message: "Token expired - Please login again" 
            });
        }

        if (error.code === 'auth/argument-error') {
            return res.status(401).json({ 
                success: false,
                message: "Invalid token format" 
            });
        }

        return res.status(401).json({ 
            success: false,
            message: "Unauthorized - Invalid token" 
        });
    }
};

export default authMiddleware;