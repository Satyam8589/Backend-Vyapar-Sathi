import multer from "multer";

const storage = multer.memoryStorage();

const fileFilter = (_req, file, callback) => {
    if (!file.mimetype || !file.mimetype.startsWith("image/")) {
        return callback(new Error("Only image files are allowed"), false);
    }

    callback(null, true);
};

const upload = multer({
    storage,
    fileFilter,
    limits: {
        fileSize: 5 * 1024 * 1024,
    },
});

export const uploadSingleProductImage = upload.single("image");