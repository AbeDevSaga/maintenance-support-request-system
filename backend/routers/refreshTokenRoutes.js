const refreshTokenController = require("../controllers/refreshTokenController");
const express = require("express");
const router = express.Router();
router.post("/", refreshTokenController.refreshAccessToken);
module.exports = router;