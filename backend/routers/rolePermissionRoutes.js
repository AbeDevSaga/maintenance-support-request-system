const express = require("express");
const router = express.Router();
const {
  assignPermissionsToRole,
  getRolePermissions,
  updateRolePermission,
  removePermissionFromRole,
} = require("../controllers/rolePermissionController");
const { authenticateToken } = require("../middlewares/authMiddleware");

router.post("/", authenticateToken, assignPermissionsToRole);          // Assign permissions to role
router.get("/", authenticateToken, getRolePermissions);                // Get all role-permissions
router.patch("/", authenticateToken, updateRolePermission);            // Update a role-permission (e.g., is_active)
router.delete("/:role_permission_id", authenticateToken, removePermissionFromRole); // Remove permission from role

module.exports = router;
