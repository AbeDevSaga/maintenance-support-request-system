const express = require("express");
const router = express.Router();
const permissionController = require("../controllers/permissionController");

const { authenticateToken,checkPermission } = require("../middlewares/authMiddleware");
router.get("/",authenticateToken,checkPermission('permissions', 'read'), permissionController.getPermissions);
router.put(
  "/activate/:permission_id",
  authenticateToken,
  checkPermission('permissions', 'update'),
  permissionController.activatePermission
);
router.put(
  "/deactivate/:permission_id",
  authenticateToken,
  checkPermission('permissions', 'update'),
  permissionController.deactivatePermission
);
router.put("/toggle/:permission_id",authenticateToken,checkPermission('permissions', 'update'), permissionController.togglePermission);

module.exports = router;
