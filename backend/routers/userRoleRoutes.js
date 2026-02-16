// routes/userRoleRoutes.js
const express = require("express");
const router = express.Router();
const { assignRolesToUser, removeRoleFromUser } = require("../controllers/userRolesController");
const { authenticateToken } = require("../middlewares/authMiddleware");

router.post("/assign", authenticateToken, assignRolesToUser);
router.post("/remove", authenticateToken, removeRoleFromUser);

module.exports = router;
