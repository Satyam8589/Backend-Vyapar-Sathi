import { auth } from '../config/firebase.js';

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

        req.user = {
            uid: decodedToken.uid,           
            email: decodedToken.email,       
            emailVerified: decodedToken.email_verified,
            name: decodedToken.name || null,
            picture: decodedToken.picture || null,
        };

        next();

    } catch (error) {
        console.error('Auth Middleware Error:', error.message);

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