import mongoose from "mongoose";

const employeeSchema = new mongoose.Schema(
  {
    // The store this employee belongs to
    store: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Store",
      required: [true, "Store is required"],
      index: true,
    },

    // The user account of this employee
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User is required"],
    },

    // The role assigned to this employee in this store
    role: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Role",
      required: [true, "Role is required"],
    },

    // Who sent the invite (owner's User ObjectId)
    invitedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // Invite status lifecycle
    status: {
      type: String,
      enum: ["pending", "active", "suspended", "rejected"],
      default: "pending",
    },

    invitedAt: {
      type: Date,
      default: Date.now,
    },

    joinedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Compound index: a user can only be an employee of a store once
employeeSchema.index({ store: 1, user: 1 }, { unique: true });

// Index for fast lookup of all employees in a store
employeeSchema.index({ store: 1, status: 1 });

// Instance method — activate an employee after they accept the invite
employeeSchema.methods.activate = function () {
  this.status = "active";
  this.joinedAt = new Date();
  return this.save();
};

// Instance method — suspend an employee
employeeSchema.methods.suspend = function () {
  this.status = "suspended";
  return this.save();
};

// Static — find all active employees of a store
employeeSchema.statics.findByStore = function (storeId) {
  return this.find({ store: storeId, status: "active" })
    .populate("user", "name email profilePicture")
    .populate("role", "name permissions");
};

const Employee = mongoose.model("Employee", employeeSchema);

export default Employee;
