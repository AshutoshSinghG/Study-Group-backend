const express = require("express");
const cors = require("cors");
const groupRoutes = require("./routes/groupRoutes");
const authRoutes = require("./routes/authRoutes");

const app = express();

app.use(cors());
app.use(express.json());

// Routes
app.use("/auth", authRoutes);
app.use("/groups", groupRoutes);

// 404 Handler
app.use((req, res, next) => {
  res.status(404).json({
    success: false,
    message: "Endpoint not found",
    data: null,
    error: {
      code: "NOT_FOUND",
      details: `Cannot ${req.method} ${req.originalUrl}`
    }
  });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    message: "Internal Server Error",
    data: null,
    error: {
      code: "INTERNAL_ERROR",
      details: err.message || "An unexpected error occurred."
    }
  });
});

module.exports = app;
