import dotenv from "dotenv";

// This must be the FIRST module imported in server.js / app.js so that
// all subsequent imports can safely read process.env.* variables.
dotenv.config();
