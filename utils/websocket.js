import { WebSocketServer } from 'ws';
import jwt from 'jsonwebtoken';
import { auth } from '../config/firebase.js';

let wss;
const clients = new Map(); // Map to store storeId -> Set of WebSockets

export const initWebSocket = (server) => {
    wss = new WebSocketServer({ server, path: '/api/ws/notifications' });

    wss.on('connection', async (ws, req) => {
        console.log('[WebSocket] Client attempting connection');

        const url = new URL(req.url, `http://${req.headers.host}`);
        const token = url.searchParams.get('token');
        const storeIdParam = url.searchParams.get('storeId');

        if (!token) {
            console.log('[WebSocket] No token provided, closing connection');
            ws.close(4001, 'Unauthorized');
            return;
        }

        try {
            let decoded = null;
            try {
                decoded = await auth.verifyIdToken(token);
            } catch (firebaseErr) {
                if (process.env.JWT_SECRET) {
                    try {
                        decoded = jwt.verify(token, process.env.JWT_SECRET);
                    } catch (jwtErr) {
                        decoded = jwt.decode(token);
                    }
                } else {
                    decoded = jwt.decode(token);
                    if (!decoded) {
                        console.error('[WebSocket] Token verification failed:', firebaseErr.message);
                        ws.close(4001, 'Invalid token');
                        return;
                    }
                }
            }

            const storeId = storeIdParam || decoded?.storeId; 

            if (storeId) {
                if (!clients.has(storeId)) {
                    clients.set(storeId, new Set());
                }
                clients.get(storeId).add(ws);
                ws.storeId = storeId;
                console.log(`[WebSocket] Client authenticated for store: ${storeId}`);
                
                // Acknowledge connection
                if (ws.readyState === 1) { // 1 = OPEN
                    ws.send(JSON.stringify({ event: 'CONNECTED', storeId }));
                }
            } else {
                ws.close(4002, 'Store ID required');
                return;
            }

            ws.on('close', () => {
                if (ws.storeId && clients.has(ws.storeId)) {
                    clients.get(ws.storeId).delete(ws);
                    if (clients.get(ws.storeId).size === 0) {
                        clients.delete(ws.storeId);
                    }
                }
                console.log('[WebSocket] Client disconnected');
            });

        } catch (error) {
            console.log('[WebSocket] Invalid token, closing connection', error.message);
            ws.close(4001, 'Invalid token');
        }
    });

    console.log('[WebSocket] Server initialized on /api/ws/notifications');
};

export const broadcastToStore = (storeId, event, data) => {
    if (clients.has(storeId)) {
        const storeClients = clients.get(storeId);
        const payload = JSON.stringify({ event, data });
        storeClients.forEach(ws => {
            if (ws.readyState === 1) { // OPEN
                ws.send(payload);
            }
        });
    }
};
