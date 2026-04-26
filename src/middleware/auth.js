const jwt = require("jsonwebtoken");
const User = require("../models/User");

const requireAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
        data: null,
        error: { code: "UNAUTHORIZED", details: "No token provided" }
      });
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "supersecretjwtkeyforgroupstudy");

    const user = await User.findById(decoded.id);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
        data: null,
        error: { code: "UNAUTHORIZED", details: "User not found" }
      });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: "Unauthorized",
      data: null,
      error: { code: "UNAUTHORIZED", details: "Invalid or expired token" }
    });
  }
};

module.exports = { requireAuth };
