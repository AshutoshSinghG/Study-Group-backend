const mongoose = require("mongoose");

const GroupGoalSchema = new mongoose.Schema({
  groupId: { type: mongoose.Schema.Types.ObjectId, ref: "StudyGroup", required: true },
  title: { type: String, required: true },
  subject: { type: mongoose.Schema.Types.ObjectId, ref: "Subject" }, // The requirements mention `subject=Math,Physics (for multi-subject goals)` in the query, but let's just make it a string if it's multiple, or use an array of ObjectIds. The input example says "subject": "Mathematics", so we might map it to Subject ID. To make it multi-subject as per "If the goal involves multiple subjects", let's use an array of ObjectIds, or maybe the example implies singular? "If the goal involves single subject... If the goal involves multiple subjects". Let's support both by using an array `subjects`.
  subjects: [{ type: mongoose.Schema.Types.ObjectId, ref: "Subject" }],
  metric: { type: String, required: true, default: "questionsSolved" }, // e.g. 'questionsSolved'
  target: { type: Number }, // e.g. 100
  deadline: { type: Date }, // Specific deadline
  frequency: { type: String, enum: ["once", "daily", "weekly"], default: "once" },
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("GroupGoal", GroupGoalSchema);
