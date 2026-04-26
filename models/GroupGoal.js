const mongoose = require("mongoose");

const GroupGoalSchema = new mongoose.Schema({
    groupId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "StudyGroup",
        required: true
    },
    title: {
        type: String,
        required: true
    },
    subjects: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "Subject"
    }],
    metric: {
        type: String,
        enum: ["questionsSolved", "percentageContributed", "timeSpent"],
        default: "questionsSolved"
    },
    targetValue: {
        type: Number,
        required: true
    },
    startDate: {
        type: Date,
        default: Date.now
    },
    deadline: {
        type: Date,
        required: true
    },
    isRecurring: {
        type: Boolean,
        default: false
    },
    frequency: {
        type: String,
        enum: ["daily", "weekly", "none"],
        default: "none"
    },
    isActive: {
        type: Boolean,
        default: true
    },
    isArchived: {
        type: Boolean,
        default: false
    }
});

// Indexing for goal tracking
GroupGoalSchema.index({ groupId: 1, isActive: 1 });

module.exports = mongoose.model("GroupGoal", GroupGoalSchema);