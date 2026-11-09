import { useAuth } from "../auth/AuthContext";

/*
 * Mirrors Banyan-CRM-BE/src/utils/permissions.js (brief section 7). The API enforces
 * these rules; the UI uses them to hide actions a role cannot take.
 *   admin -> Admin · manager, operator -> Sales · read_only -> Read-only
 */
const GROUP = { admin: "admin", manager: "sales", operator: "sales", read_only: "read_only" };
const PERMISSIONS = {
  "records.write": ["admin", "sales"],
  "bookings.write": ["admin", "sales"],
  "bookings.refund": ["admin"],
  "resources.manage": ["admin"],
  "workflows.view": ["admin", "sales"],
  "workflows.manage": ["admin"],
  "templates.use": ["admin", "sales"],
  "templates.manage": ["admin"],
  "users.manage": ["admin"],
  "workspace.manage": ["admin"],
};
export const ROLE_OPTIONS = [
  ["admin", "Admin"],
  ["manager", "Sales (manager)"],
  ["operator", "Sales (operator)"],
  ["read_only", "Read-only"],
];
export const roleLabel = (role) => (ROLE_OPTIONS.find(([value]) => value === role) || [])[1] || role || "—";

export function usePermissions() {
  const { user } = useAuth();
  const group = GROUP[user?.role] || "read_only";
  return {
    group,
    readOnly: group === "read_only",
    can: (permission) => (PERMISSIONS[permission] || []).includes(group),
  };
}
