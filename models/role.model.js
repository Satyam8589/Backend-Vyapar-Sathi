import mongoose from "mongoose";
import { ALL_PERMISSIONS } from "../utils/permissions.js";

const roleSchema = new mongoose.Schema(
  {
    // Store this role belongs to (null = system default role)
    store: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Store",
      default: null,
      index: true,
    },

    name: {
      type: String,
      required: [true, "Role name is required"],
      trim: true,
      maxlength: [50, "Role name cannot exceed 50 characters"],
    },

    // true = seeded system role (Owner, Manager, Cashier etc.) — cannot be deleted
    isSystem: {
      type: Boolean,
      default: false,
    },

    // Array of permission key strings e.g. ["billing:view", "inventory:add"]
    permissions: {
      type: [String],
      enum: {
        values: ALL_PERMISSIONS,
        message: "'{VALUE}' is not a valid permission key",
      },
      default: [],
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Compound index: unique role name per store
roleSchema.index({ store: 1, name: 1 }, { unique: true });

// Check if a role has a specific permission
roleSchema.methods.hasPermission = function (permissionKey) {
  return this.permissions.includes(permissionKey);
};

const Role = mongoose.model("Role", roleSchema);

export default Role;
