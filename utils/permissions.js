/**
 * MASTER PERMISSION LIST — Vyapar-Sathi
 *
 * Single source of truth for all permission keys.
 * Format: "module:action"
 * These are stored as an array in each Role document.
 */

export const PERMISSIONS = {
  // ─── Billing & Checkout ─────────────────────────────────────────────────────
  BILLING_VIEW:           "billing:view",
  BILLING_CREATE:         "billing:create",
  BILLING_APPLY_DISCOUNT: "billing:apply_discount",
  BILLING_CANCEL:         "billing:cancel_bill",
  BILLING_VIEW_HISTORY:   "billing:view_history",
  
  BILLING_PRINT:          "billing:print_bill",
  BILLING_ACCEPT_UPI:     "billing:accept_upi",
  BILLING_ACCEPT_CASH:    "billing:accept_cash",

  // ─── Inventory Management ────────────────────────────────────────────────────
  INVENTORY_VIEW:         "inventory:view",
  INVENTORY_ADD:          "inventory:add",
  INVENTORY_EDIT:         "inventory:edit",
  INVENTORY_DELETE:       "inventory:delete",
  INVENTORY_VIEW_COST:    "inventory:view_cost_price",
  INVENTORY_MANAGE_STOCK: "inventory:manage_stock",
  INVENTORY_MANAGE_EXPIRY:"inventory:manage_expiry",
  INVENTORY_IMPORT_EXPORT:"inventory:import_export",

  // ─── Reports & Analytics ────────────────────────────────────────────────────
  REPORTS_VIEW_SALES:     "reports:view_sales",
  REPORTS_VIEW_STOCK:     "reports:view_stock",
  REPORTS_VIEW_PROFIT:    "reports:view_profit",
  REPORTS_EXPORT:         "reports:export",

  // ─── Store Settings ─────────────────────────────────────────────────────────
  STORE_VIEW_SETTINGS:    "store:view_settings",
  STORE_EDIT_SETTINGS:    "store:edit_settings",
  STORE_MANAGE_UPI:       "store:manage_upi",
  STORE_MANAGE_EMPLOYEES: "store:manage_employees",
  STORE_MANAGE_ROLES:     "store:manage_roles",

  // ─── Employee Management ────────────────────────────────────────────────────
  EMPLOYEES_VIEW:         "employees:view",
  EMPLOYEES_INVITE:       "employees:invite",
  EMPLOYEES_REMOVE:       "employees:remove",
  EMPLOYEES_EDIT_ROLE:    "employees:edit_role",
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
      // Billing — all
      "billing:view", "billing:create", "billing:apply_discount",
      "billing:cancel_bill", "billing:view_history", "billing:print_bill",
      "billing:accept_upi", "billing:accept_cash",
      // Inventory — all
      "inventory:view", "inventory:add", "inventory:edit",
      "inventory:view_cost_price", "inventory:manage_stock",
      "inventory:manage_expiry", "inventory:import_export",
      // Reports — all except export
      "reports:view_sales", "reports:view_stock", "reports:view_profit",
      // Employees — view & invite
      "employees:view", "employees:invite",
      // Store — view only
      "store:view_settings",
    ],
  },

  CASHIER: {
    name: "Cashier",
    isSystem: true,
    permissions: [
      "billing:view", "billing:create", "billing:view_history",
      "billing:print_bill", "billing:accept_upi", "billing:accept_cash",
      "inventory:view",
    ],
  },

  INVENTORY_STAFF: {
    name: "Inventory Staff",
    isSystem: true,
    permissions: [
      "inventory:view", "inventory:add", "inventory:edit",
      "inventory:manage_stock", "inventory:manage_expiry",
      "reports:view_stock",
    ],
  },

  VIEWER: {
    name: "Viewer",
    isSystem: true,
    permissions: [
      "billing:view", "billing:view_history",
      "inventory:view",
      "reports:view_sales", "reports:view_stock",
      "store:view_settings",
      "employees:view",
    ],
  },
};
