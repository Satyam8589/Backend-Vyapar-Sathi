import app from "./app.js";
import dotenv from "dotenv";
import http from "http";
dotenv.config();

const PORT = process.env.PORT || 5000;

const server = http.createServer(app);

const start = async () => {
    try {
        server.listen(PORT, () => {
            console.log(`Server is running on port http://localhost:${PORT}`);
        });
    } catch (error) {
        console.log("Server is not running", error);
    }
};

start();
