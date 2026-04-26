const jwt = require("jsonwebtoken");
const passport = require("passport");

// go to google login
const googleLogin = passport.authenticate("google", {
  scope: ["profile", "email"],
  session: false,
});

// Jab Google login successful ho jaye, toh Google yahan wapas bhejta hai
const googleCallback = (req, res, next) => {
  passport.authenticate("google", { session: false }, (err, user, info) => {
    if (err) {
      console.error("Google Auth error:", err);
      return res.status(500).json({
        success: false,
        message: "OAuth process fail ho gaya",
        error: { code: "AUTH_ERROR", details: err.message }
      });
    }

    // if user not found
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Google se authentication nahi ho paya",
        error: { code: "OAUTH_FAILED" }
      });
    }

    //JWT token create
    const token = jwt.sign(
      { userId: user._id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    // Final Success Response
    return res.status(200).json({
      success: true,
      message: "Mast! Login successful raha",
      data: {
        token,
        user: {
          id: user._id,
          email: user.email,
          name: user.name,
          avatar: user.avatar,
        },
      },
      error: null
    });
  })(req, res, next);
};

// Logged in user ki apni details dekhne ke liye
const getMe = async (req, res) => {
  try {
    return res.status(200).json({
      success: true,
      message: "User details mil gayi",
      data: {
        id: req.user._id,
        email: req.user.email,
        name: req.user.name,
        avatar: req.user.avatar,
      }
    });
  } catch (err) {
    console.log("getMe function mein dikat aayi:", err);
    return res.status(500).json({ success: false, message: "Fetch fail" });
  }
};

module.exports = { googleLogin, googleCallback, getMe };