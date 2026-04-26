require("dotenv").config();

const express = require("express");
const cors = require("cors");
const connectDB = require("./config/db");
const { connectRedis } = require("./config/redis");
const passport = require("./config/passport");
const errorHandler = require("./middleware/errorHandler");

// route imports
const authRoutes = require("./routes/authRoutes");
const groupRoutes = require("./routes/groupRoutes");
const subjectRoutes = require("./routes/subjectRoutes");

const app = express();

// middleware
app.use(cors());
app.use(express.json());
app.use(passport.initialize());

// routes
app.use("/auth", authRoutes);
app.use("/groups", groupRoutes);
app.use("/subjects", subjectRoutes);

// quick health check
app.get("/", (req, res) => {
  res.json({ status: "ok", message: "Study Group API is running" });
});

// TODO: add rate limiting at some point

// global error handler - needs to be after routes
app.use(errorHandler);

// start everything up
const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    await connectDB();
    connectRedis();

    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (err) {
    console.log("Failed to start server:", err);
    process.exit(1);
  }
};

startServer();
