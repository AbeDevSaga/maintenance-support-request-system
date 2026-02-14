const express = require("express");
const router = express.Router();
const permissionController = require("../controllers/permissionController");

const { authenticateToken } = require("../middlewares/authMiddleware");
router.get("/",authenticateToken, permissionController.getPermissions);
router.put(
  "/activate/:permission_id",
  authenticateToken,
  permissionController.activatePermission
);
router.put(
  "/deactivate/:permission_id",
  authenticateToken,
  permissionController.deactivatePermission
);
router.put("/toggle/:permission_id",authenticateToken, permissionController.togglePermission);

module.exports = router;
