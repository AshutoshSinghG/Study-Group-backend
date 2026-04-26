const mongoose = require("mongoose");

const ActivitySchema = new mongoose.Schema({
    groupId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "StudyGroup",
        required: true
    },
    goalId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "GroupGoal",
        required: true
    },
    userEmail: {
        type: String,
        required: true
    },
    questionId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Question",
        required: true
    },
    subjectId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Subject",
        required: true
    },
    status: {
        type: String,
        enum: ["solved", "correct"],
        required: true
    },
    timeSpent: {
        type: Number,
        required: true
    },
    timestamp: {
        type: Date,
        default: Date.now
    }
});

ActivitySchema.index({ goalId: 1, userEmail: 1, questionId: 1 }, { unique: true });
ActivitySchema.index({ timestamp: 1 });

module.exports = mongoose.model("GroupMemberActivity", ActivitySchema);