const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { v4: uuidv4 } = require("uuid");

exports.mockGoogleLogin = async (req, res, next) => {
  try {
    const { email, name } = req.body;
    if (!email || !name) {
      return res.status(400).json({
        success: false,
        message: "Email and name are required",
        data: null,
        error: { code: "BAD_REQUEST", details: "Missing email or name" }
      });
    }

    let user = await User.findOne({ email });
    if (!user) {
      user = new User({
        email,
        name,
        googleId: `mock-google-id-${uuidv4()}`,
        avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${name}`
      });
      await user.save();
    }

    const token = jwt.sign(
      { id: user._id, email: user.email },
      process.env.JWT_SECRET || "supersecretjwtkeyforgroupstudy",
      { expiresIn: "7d" }
    );

    res.status(200).json({
      success: true,
      message: "Logged in successfully",
      data: { token, user },
      error: null
    });
  } catch (error) {
    next(error);
  }
};
