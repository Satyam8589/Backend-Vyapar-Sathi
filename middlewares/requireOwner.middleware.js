import { ApiError } from "../utils/ApiError.js";
import { Store } from "../models/index.js";

const requireOwner = async (req, res, next) => {
  try {
    const { storeId } = req.params;

    if (!storeId) {
      throw new ApiError("Store ID is required in request parameters", 400);
    }

    const store = await Store.findById(storeId);

    if (!store) {
      throw new ApiError("Store not found", 404);
    }

    if (store.owner.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: "Forbidden: Only the store owner can perform this action.",
        statusCode: 403,
      });
    }

    req.store = store;
    next();
  } catch (error) {
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Internal Server Error",
      statusCode: error.statusCode || 500,
    });
  }
};

export default requireOwner;
