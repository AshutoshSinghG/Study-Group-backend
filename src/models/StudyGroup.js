const mongoose = require("mongoose");

const StudyGroupSchema = new mongoose.Schema({
  name: { type: String, required: true },
  creator: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true }, // A single user can be a creator in only one group at a time
  members: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }], // Multiple members
  activeGoal: { type: mongoose.Schema.Types.ObjectId, ref: "GroupGoal", default: null }, // 1 active goal at a time
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("StudyGroup", StudyGroupSchema);
