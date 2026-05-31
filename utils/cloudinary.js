import { v2 as cloudinary } from "cloudinary";

let configured = false;

const configureCloudinary = () => {
    if (configured) return cloudinary;

    const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET } = process.env;

    if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
        throw new Error("Cloudinary environment variables are missing");
    }

    cloudinary.config({
        cloud_name: CLOUDINARY_CLOUD_NAME,
        api_key: CLOUDINARY_API_KEY,
        api_secret: CLOUDINARY_API_SECRET,
        secure: true,
    });

    

    configured = true;
    return cloudinary;
};

export const uploadBufferToCloudinary = (buffer, options = {}) => {
    const client = configureCloudinary();

    return new Promise((resolve, reject) => {
        const stream = client.uploader.upload_stream(options, (error, result) => {
            if (error) return reject(error);
            resolve(result);
        });

        stream.end(buffer);
    });
};

export default cloudinary;