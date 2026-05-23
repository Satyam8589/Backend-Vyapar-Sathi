import { Employee, User, Role, Store } from "../../models/index.js";
import { ApiError } from "../../utils/ApiError.js";
import { sendInviteEmail } from "../../utils/mailer.js";
import crypto from "crypto";

/**
 * Invite an employee to a store — generates a secure token and sends an email.
 */
export const inviteEmployee = async (storeId, invitedByUserId, employeeData) => {
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

  // Generate a secure random token (valid for 48 hours)
  const inviteToken = crypto.randomBytes(32).toString("hex");
  const inviteTokenExpiry = new Date(Date.now() + 48 * 60 * 60 * 1000);

  const employee = await Employee.create({
    store: storeId,
    user: userToInvite._id,
    role: roleId,
    invitedBy: invitedByUserId,
    status: "pending",
    inviteToken,
    inviteTokenExpiry,
  });

  // Fetch store + inviter info for the email
  const [store, inviter] = await Promise.all([
    Store.findById(storeId).select("name"),
    User.findById(invitedByUserId).select("name"),
  ]);

  // Send the invitation email (non-blocking — don't fail the whole request if email fails)
  sendInviteEmail(email, {
    storeName: store?.name || "the store",
    roleName: role.name,
    ownerName: inviter?.name || "The owner",
    inviteToken,
  }).catch((err) => {
    console.error("Failed to send invite email:", err);
    console.log(`\n[FALLBACK] Copy this invite link for ${email}: ${process.env.FRONTEND_URL}/invite/${inviteToken}\n`);
  });

  return employee;
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
