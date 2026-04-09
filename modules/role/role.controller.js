import * as roleService from "./role.service.js";
import { ApiResponse } from "../../utils/ApiResponse.js";

export const getRolesController = async (req, res) => {
  try {
    const { storeId } = req.params;
    const roles = await roleService.getRolesByStore(storeId);
    res.status(200).json(new ApiResponse(roles, "Roles fetched successfully", 200));
  } catch (error) {
    res.status(error.statusCode || 500).json(new ApiResponse(null, error.message, error.statusCode || 500));
  }
};

export const createRoleController = async (req, res) => {
  try {
    const { storeId } = req.params;
    const userId = req.user._id;
    const role = await roleService.createCustomRole(storeId, userId, req.body);
    res.status(201).json(new ApiResponse(role, "Custom role created successfully", 201));
  } catch (error) {
    res.status(error.statusCode || 500).json(new ApiResponse(null, error.message, error.statusCode || 500));
  }
};

export const updateRoleController = async (req, res) => {
  try {
    const { storeId, roleId } = req.params;
    const role = await roleService.updateRole(roleId, storeId, req.body);
    res.status(200).json(new ApiResponse(role, "Role updated successfully", 200));
  } catch (error) {
    res.status(error.statusCode || 500).json(new ApiResponse(null, error.message, error.statusCode || 500));
  }
};

export const deleteRoleController = async (req, res) => {
  try {
    const { storeId, roleId } = req.params;
    const role = await roleService.deleteRole(roleId, storeId);
    res.status(200).json(new ApiResponse(role, "Role deleted successfully", 200));
  } catch (error) {
    res.status(error.statusCode || 500).json(new ApiResponse(null, error.message, error.statusCode || 500));
  }
};

export const seedRolesController = async (req, res) => {
  try {
    const { storeId } = req.params;
    const userId = req.user._id;
    const roles = await roleService.seedSystemRoles(storeId, userId);
    res.status(200).json(new ApiResponse(roles, "System roles seeded successfully", 200));
  } catch (error) {
    res.status(error.statusCode || 500).json(new ApiResponse(null, error.message, error.statusCode || 500));
  }
};
