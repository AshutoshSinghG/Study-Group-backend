const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");

router.post("/mock-google-login", authController.mockGoogleLogin);

module.exports = router;
