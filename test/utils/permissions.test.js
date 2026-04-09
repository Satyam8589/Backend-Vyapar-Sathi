import { PERMISSIONS, ALL_PERMISSIONS, SYSTEM_ROLES } from "../../utils/permissions.js";

describe("Permissions Constants", () => {
  test("ALL_PERMISSIONS should contain all permission values", () => {
    const values = Object.values(PERMISSIONS);
    expect(ALL_PERMISSIONS).toHaveLength(values.length);
    expect(ALL_PERMISSIONS).toEqual(expect.arrayContaining(values));
  });

  test("SYSTEM_ROLES should have correct structure", () => {
    Object.keys(SYSTEM_ROLES).forEach(roleKey => {
      const role = SYSTEM_ROLES[roleKey];
      expect(role).toHaveProperty("name");
      expect(role).toHaveProperty("isSystem", true);
      expect(role).toHaveProperty("permissions");
      expect(Array.isArray(role.permissions)).toBe(true);
    });
  });

  test("OWNER should have ALL permissions", () => {
    expect(SYSTEM_ROLES.OWNER.permissions).toHaveLength(ALL_PERMISSIONS.length);
  });

  test("No duplicate permission keys or values", () => {
      const keys = Object.keys(PERMISSIONS);
      const values = Object.values(PERMISSIONS);
      
      const uniqueKeys = new Set(keys);
      const uniqueValues = new Set(values);
      
      expect(uniqueKeys.size).toBe(keys.length);
      expect(uniqueValues.size).toBe(values.length);
  });
});
