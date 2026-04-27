const mongoose = require("mongoose");

const GroupGoalSchema = new mongoose.Schema({
    group: {
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
    targetCount: {
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
    goalType: {
        type: String,
        enum: ["deadline", "recurring"],
        default: "deadline"
    },
    frequency: {
        type: String,
        enum: ["daily", "weekly", "none"],
        default: "none"
    },
    isActive: {
        type: Boolean,
        default: true
    }
});

GroupGoalSchema.index({ group: 1, isActive: 1 });

module.exports = mongoose.model("GroupGoal", GroupGoalSchema);