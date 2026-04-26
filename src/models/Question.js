const mongoose = require("mongoose");

const QuestionSchema = new mongoose.Schema({
  text: { type: String, required: true },
  subjectId: { type: mongoose.Schema.Types.ObjectId, ref: "Subject", required: true },
  topic: { type: String }, // optional e.g. "Algebra"
  difficulty: { type: String, enum: ["easy", "medium", "hard"], default: "medium" },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Question", QuestionSchema);
