const mongoose = require("mongoose");

const GroupMemberActivitySchema = new mongoose.Schema({
  groupId: { type: mongoose.Schema.Types.ObjectId, ref: "StudyGroup", required: true },
  goalId: { type: mongoose.Schema.Types.ObjectId, ref: "GroupGoal", required: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  questionId: { type: mongoose.Schema.Types.ObjectId, ref: "Question", required: true },
  subjectId: { type: mongoose.Schema.Types.ObjectId, ref: "Subject", required: true },
  status: { type: String, enum: ["solved", "correct", "attempted"], required: true },
  timeSpent: { type: Number, required: true }, // in seconds or milliseconds
  timestamp: { type: Date, default: Date.now }
});

// Index for per-user deduplication of solved questions toward a specific goal
GroupMemberActivitySchema.index({ user: 1, questionId: 1, goalId: 1, status: 1 });

module.exports = mongoose.model("GroupMemberActivity", GroupMemberActivitySchema);
