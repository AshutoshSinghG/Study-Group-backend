const mongoose = require("mongoose");

// just connect to mongo, nothing fancy
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI);
    console.log(`MongoDB connected: ${conn.connection.host}`);
  } catch (err) {
    console.log("Failed to connect to MongoDB:", err.message);
    process.exit(1);
  }
};

module.exports = connectDB;
