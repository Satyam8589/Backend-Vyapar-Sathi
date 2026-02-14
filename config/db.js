import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URL);
        console.log("MongoDB connected");
        
        // Clean up legacy global barcode index if it exists
        try {
            const collection = mongoose.connection.collection('products');
            const indexes = await collection.indexes();
            if (indexes.some(i => i.name === 'barcode_1')) {
                console.log("Dropping legacy 'barcode_1' index...");
                await collection.dropIndex('barcode_1');
                console.log("Legacy index dropped successfully.");
            }
        } catch (idxError) {
            console.log("Note: Could not drop legacy index (it may not exist or is already being handled).");
        }
    } catch (error) {
        console.log("MongoDB connection error", error);
    }
};

export default connectDB;
