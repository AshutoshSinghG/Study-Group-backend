const express = require("express");
const router = express.Router();
const { googleLogin, googleCallback, getMe } = require("../controllers/authController");
const { protect } = require("../middleware/auth");

router.get("/google", googleLogin);
router.get("/google/callback", googleCallback);
router.get("/me", protect, getMe);

module.exports = router;