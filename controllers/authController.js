const jwt = require("jsonwebtoken");
const passport = require("passport");
const { sendSuccess, sendError } = require("../utils/response");


const googleLogin = passport.authenticate("google", {
  scope: ["profile", "email"],
  session: false,
});

// google sends user back here after they login
const googleCallback = (req, res, next) => {
  passport.authenticate("google", { session: false }, (err, user, info) => {
    if (err) {
      console.log("Google callback error:", err);
      return sendError(res, "OAuth failed", "OAUTH_ERROR", err.message, 500);
    }

    if (!user) {
      return sendError(
        res,
        "Could not authenticate with Google",
        "OAUTH_FAILED",
        null,
        401
      );
    }


    // create JWT for the user
    const tokenPayload = {
      userId: user._id,
      email: user.email,
    };

    const token = jwt.sign(tokenPayload, process.env.JWT_SECRET, {
      expiresIn: "7d",
    });



    return sendSuccess(res, "Login successful", {
      token,
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        avatar: user.avatar,
      },
    });
  })(req, res, next);
};

// get current logged in user's info
const getMe = async (req, res) => {
  try {
    return sendSuccess(res, "User info retrieved", {
      id: req.user._id,
      email: req.user.email,
      name: req.user.name,
      avatar: req.user.avatar,
    });
  } catch (err) {
    console.log("getMe broke:", err);
    return sendError(res, "Failed to get user info", "FETCH_ERROR", null, 500);
  }
};

module.exports = { googleLogin, googleCallback, getMe };
