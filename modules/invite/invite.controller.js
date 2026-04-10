import { Employee, User, Store, Role } from "../../models/index.js";
import { ApiError } from "../../utils/ApiError.js";

/**
 * GET /api/invite/:token
 * Verify an invite token and return preview info (store name, role, etc.)
 */
export const verifyInviteToken = async (req, res) => {
  try {
    const { token } = req.params;

    const employee = await Employee.findOne({
      inviteToken: token,
      status: "pending",
      inviteTokenExpiry: { $gt: new Date() }, // not expired
    })
      .populate("store", "name")
      .populate("role", "name")
      .populate("invitedBy", "name email");

    if (!employee) {
      return res.status(400).json({ success: false, message: "Invalid or expired invite link." });
    }

    return res.status(200).json({
      success: true,
      data: {
        storeName: employee.store?.name,
        roleName: employee.role?.name,
        invitedBy: employee.invitedBy?.name,
        employeeId: employee._id,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * POST /api/invite/:token/accept
 * Accept an invitation (logged-in user only)
 */
export const acceptInvite = async (req, res) => {
  try {
    const { token } = req.params;

    const employee = await Employee.findOne({
      inviteToken: token,
      status: "pending",
      inviteTokenExpiry: { $gt: new Date() },
    });

    if (!employee) {
      return res.status(400).json({ success: false, message: "Invalid or expired invite link." });
    }

    // Security check: Ensure the logged-in user is the one invited
    if (employee.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ 
        success: false, 
        message: "This invitation was sent to a different account. Please login with the correct email." 
      });
    }

    // Activate the employee
    employee.status = "active";
    employee.joinedAt = new Date();
    employee.inviteToken = null;    // invalidate token after use
    employee.inviteTokenExpiry = null;
    await employee.save();

    return res.status(200).json({
      success: true,
      message: "You have successfully joined the store!",
      data: { storeId: employee.store },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * POST /api/invite/:token/decline
 * Decline an invitation
 */
export const declineInvite = async (req, res) => {
  try {
    const { token } = req.params;

    const employee = await Employee.findOne({
      inviteToken: token,
      status: "pending",
    });

    if (!employee) {
      return res.status(400).json({ success: false, message: "Invalid invite link." });
    }

    // Reject and clean up
    employee.status = "rejected";
    employee.inviteToken = null;
    employee.inviteTokenExpiry = null;
    await employee.save();

    return res.status(200).json({
      success: true,
      message: "Invitation declined.",
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
