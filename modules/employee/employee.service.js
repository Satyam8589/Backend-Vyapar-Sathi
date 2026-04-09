import { Employee, User, Role } from "../../models/index.js";
import { ApiError } from "../../utils/ApiError.js";

/**
 * Invite an employee to a store
 */
export const inviteEmployee = async (storeId, invitedByUserId, employeeData) => {
  try {
    const { email, roleId } = employeeData;

    if (!email || !roleId) {
      throw new ApiError("Email and role are required", 400);
    }

    const userToInvite = await User.findOne({ email });
    if (!userToInvite) {
      throw new ApiError(`User with email '${email}' not found. They must register first.`, 404);
    }

    const existingEmployee = await Employee.findOne({ store: storeId, user: userToInvite._id });
    if (existingEmployee) {
      throw new ApiError("User is already an employee of this store", 409);
    }
    const role = await Role.findOne({ _id: roleId });
    if (!role) {
      throw new ApiError("Role not found", 404);
    }
    if (!role.isSystem && role.store.toString() !== storeId.toString()) {
        throw new ApiError("Role does not belong to this store", 403);
    }
    const employee = await Employee.create({
      store: storeId,
      user: userToInvite._id,
      role: roleId,
      invitedBy: invitedByUserId,
      status: "pending"
    });

    return employee;
  } catch (error) {
    throw error;
  }
};

/**
 * Get all employees in a store
 */
export const getEmployeesByStore = async (storeId) => {
  try {
    const employees = await Employee.find({ store: storeId })
      .populate("user", "name email profilePicture")
      .populate("role", "name permissions");
    return employees;
  } catch (error) {
    throw error;
  }
};

/**
 * Update an employee's role or status
 */
export const updateEmployee = async (employeeId, storeId, updateData) => {
  try {
    const employee = await Employee.findOne({ _id: employeeId, store: storeId });
    if (!employee) {
      throw new ApiError("Employee record not found", 404);
    }

    // If updating role, verify the new role
    if (updateData.role) {
        const role = await Role.findOne({ _id: updateData.role });
        if (!role) throw new ApiError("New role not found", 404);
        if (!role.isSystem && role.store.toString() !== storeId.toString()) {
            throw new ApiError("Role does not belong to this store", 403);
        }
    }

    employee.set(updateData);
    await employee.save();

    return employee;
  } catch (error) {
    throw error;
  }
};

/**
 * Remove an employee from a store
 */
export const removeEmployee = async (employeeId, storeId) => {
  try {
    const employee = await Employee.findOne({ _id: employeeId, store: storeId });
    if (!employee) {
      throw new ApiError("Employee record not found", 404);
    }

    await Employee.deleteOne({ _id: employeeId });
    return employee;
  } catch (error) {
    throw error;
  }
};

/**
 * Accept invite (called by the employee themselves)
 */
export const acceptInvite = async (userId, employeeId) => {
    try {
        const employee = await Employee.findOne({ _id: employeeId, user: userId });
        if (!employee) {
            throw new ApiError("Invitation not found", 404);
        }
        if (employee.status !== 'pending') {
            throw new ApiError(`Invitation is already ${employee.status}`, 400);
        }

        employee.status = 'active';
        employee.joinedAt = new Date();
        await employee.save();

        return employee;
    } catch (error) {
        throw error;
    }
};
