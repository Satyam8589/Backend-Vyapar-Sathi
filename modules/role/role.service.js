import { Role } from "../../models/index.js";
import { ApiError } from "../../utils/ApiError.js";
import { SYSTEM_ROLES } from "../../utils/permissions.js";

/**
 * Ensures system roles exist in the database for a specific store.
 * Note: Since system roles are templates, we can either create them per store
 * or have global ones (store: null). Here we create them per store for flexibility.
 */
export const seedSystemRoles = async (storeId, userId) => {
  try {
    const rolesToCreate = Object.values(SYSTEM_ROLES).map((role) => ({
      ...role,
      store: storeId,
      createdBy: userId,
    }));

    // Using insertMany with ordered: false to skip duplicates if any
    const createdRoles = await Role.insertMany(rolesToCreate, { ordered: false }).catch(err => {
        // Handle duplicate key error if roles already exist
        if (err.code === 11000) return Role.find({ store: storeId, isSystem: true });
        throw err;
    });

    return createdRoles;
  } catch (error) {
    throw error;
  }
};

/**
 * Get all roles for a store (System + Custom)
 */
export const getRolesByStore = async (storeId) => {
  try {
    // First, ensure system roles are there (optional, can be done on store creation)
    // For now, let's just fetch what exists.
    const roles = await Role.find({ store: storeId }).sort({ isSystem: -1, createdAt: 1 });
    return roles;
  } catch (error) {
    throw error;
  }
};

/**
 * Create a custom role
 */
export const createCustomRole = async (storeId, userId, roleData) => {
  try {
    const { name, permissions } = roleData;

    if (!name || !permissions) {
      throw new ApiError("Role name and permissions are required", 400);
    }

    const existingRole = await Role.findOne({ store: storeId, name });
    if (existingRole) {
      throw new ApiError(`Role with name '${name}' already exists in this store`, 409);
    }

    const newRole = await Role.create({
      store: storeId,
      createdBy: userId,
      name,
      permissions,
      isSystem: false
    });

    return newRole;
  } catch (error) {
    throw error;
  }
};

/**
 * Update a role (Custom roles only)
 */
export const updateRole = async (roleId, storeId, roleData) => {
  try {
    const role = await Role.findOne({ _id: roleId, store: storeId });

    if (!role) {
      throw new ApiError("Role not found", 404);
    }

    if (role.isSystem) {
      throw new ApiError("System roles cannot be modified", 403);
    }

    role.set(roleData);
    await role.save();

    return role;
  } catch (error) {
    throw error;
  }
};

/**
 * Delete a role (Custom roles only)
 */
export const deleteRole = async (roleId, storeId) => {
  try {
    const role = await Role.findOne({ _id: roleId, store: storeId });

    if (!role) {
      throw new ApiError("Role not found", 404);
    }

    if (role.isSystem) {
      throw new ApiError("System roles cannot be deleted", 403);
    }

    // TODO: check if any employees are using this role before deleting
    // For now, we delete it directly.

    await Role.deleteOne({ _id: roleId });
    return role;
  } catch (error) {
    throw error;
  }
};
