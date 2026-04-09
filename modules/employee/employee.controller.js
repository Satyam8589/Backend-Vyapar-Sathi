import * as employeeService from "./employee.service.js";
import { ApiResponse } from "../../utils/ApiResponse.js";

export const inviteEmployeeController = async (req, res) => {
  try {
    const { storeId } = req.params;
    const invitedByUserId = req.user._id;
    const employee = await employeeService.inviteEmployee(storeId, invitedByUserId, req.body);
    res.status(201).json(new ApiResponse(employee, "Employee invited successfully", 201));
  } catch (error) {
    res.status(error.statusCode || 500).json(new ApiResponse(null, error.message, error.statusCode || 500));
  }
};

export const getEmployeesController = async (req, res) => {
  try {
    const { storeId } = req.params;
    const employees = await employeeService.getEmployeesByStore(storeId);
    res.status(200).json(new ApiResponse(employees, "Employees fetched successfully", 200));
  } catch (error) {
    res.status(error.statusCode || 500).json(new ApiResponse(null, error.message, error.statusCode || 500));
  }
};

export const updateEmployeeController = async (req, res) => {
  try {
    const { storeId, employeeId } = req.params;
    const employee = await employeeService.updateEmployee(employeeId, storeId, req.body);
    res.status(200).json(new ApiResponse(employee, "Employee updated successfully", 200));
  } catch (error) {
    res.status(error.statusCode || 500).json(new ApiResponse(null, error.message, error.statusCode || 500));
  }
};

export const removeEmployeeController = async (req, res) => {
  try {
    const { storeId, employeeId } = req.params;
    const employee = await employeeService.removeEmployee(employeeId, storeId);
    res.status(200).json(new ApiResponse(employee, "Employee removed successfully", 200));
  } catch (error) {
    res.status(error.statusCode || 500).json(new ApiResponse(null, error.message, error.statusCode || 500));
  }
};

export const acceptInviteController = async (req, res) => {
    try {
        const { employeeId } = req.params;
        const userId = req.user._id;
        const employee = await employeeService.acceptInvite(userId, employeeId);
        res.status(200).json(new ApiResponse(employee, "Invitation accepted successfully", 200));
    } catch (error) {
        res.status(error.statusCode || 500).json(new ApiResponse(null, error.message, error.statusCode || 500));
    }
};
