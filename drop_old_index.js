import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '.env') });

const dropIndex = async () => {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_URL);
    console.log('Connected!');

    const collection = mongoose.connection.collection('products');
    
    console.log('Checking existing indexes...');
    const indexes = await collection.indexes();
    console.log('Found indexes:', indexes.map(i => i.name));

    if (indexes.some(i => i.name === 'barcode_1')) {
      console.log('Dropping globe unique "barcode_1" index...');
      await collection.dropIndex('barcode_1');
      console.log('Successfully dropped "barcode_1"!');
    } else {
      console.log('No "barcode_1" index found to drop.');
    }

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
};

dropIndex();
