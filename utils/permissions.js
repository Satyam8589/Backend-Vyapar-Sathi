export const PERMISSIONS = {
  // ─── Core Actions ───────────────────────────────────────────────────────────
  BILLING_CREATE:         "billing:create",      // Can create bills & view history
  INVENTORY_ADD:          "inventory:add",       // Can add new products
  INVENTORY_MANAGE:       "inventory:manage",    // Can edit and delete products
};

// All permission values as a flat array (used for validation)
export const ALL_PERMISSIONS = Object.values(PERMISSIONS);

// ─── Pre-built Role Templates ─────────────────────────────────────────────────

export const SYSTEM_ROLES = {
  OWNER: {
    name: "Owner",
    isSystem: true,
    permissions: ALL_PERMISSIONS,
  },

  MANAGER: {
    name: "Manager",
    isSystem: true,
    permissions: [
      "billing:create",
      "inventory:add",
      "inventory:manage",
    ],
  },

  CASHIER: {
    name: "Cashier",
    isSystem: true,
    permissions: [
      "billing:create",
    ],
  },

  STOCK_MANAGER: {
    name: "Stock Manager",
    isSystem: true,
    permissions: [
      "inventory:add",
      "inventory:manage",
    ],
  },
};
