import "./config/env.js"; // MUST be first — loads dotenv before any other module reads process.env
import app from "./app.js";
import http from "http";


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
