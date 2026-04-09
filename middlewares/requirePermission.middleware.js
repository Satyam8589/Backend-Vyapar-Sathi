import { ApiError } from "../utils/ApiError.js";
import { Store, Employee, Role } from "../models/index.js";

const requirePermission = (permissionKey) => {
  return async (req, res, next) => {
    try {
      const { storeId } = req.params;
      const userId = req.user._id;

      if (!storeId) {
        throw new ApiError("Store ID is required in request parameters", 400);
      }

      const store = await Store.findById(storeId);
      if (!store) {
        throw new ApiError("Store not found", 404);
      }

      if (store.owner.toString() === userId.toString()) {
        req.store = store;
        req.userRole = "owner";
        return next();
      }

      const employee = await Employee.findOne({
        store: storeId,
        user: userId,
        status: "active",
      }).populate("role");

      if (!employee || !employee.role) {
        return res.status(403).json({
          success: false,
          message: "Access Denied: You do not have permission to access this store.",
          statusCode: 403,
        });
      }

      if (employee.role.permissions.includes(permissionKey)) {
        req.store = store;
        req.employee = employee;
        req.userRole = employee.role.name;
        return next();
      }

      return res.status(403).json({
        success: false,
        message: `Forbidden: You do not have the required permission (${permissionKey}) for this action.`,
        statusCode: 403,
      });
    } catch (error) {
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || "Internal Server Error",
        statusCode: error.statusCode || 500,
      });
    }
  };
};

export default requirePermission;
