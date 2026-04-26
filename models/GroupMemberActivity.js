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
        enum: ["solved", "correct"], // Task: Only count these [cite: 45]
        required: true
    },
    timeSpent: {
        type: Number, // Seconds mein
        required: true
    },
    timestamp: {
        type: Date,
        default: Date.now
    }
});

// Crucial Indexing: Taaki leaderboard queries fast rahein aur de-duplication ho sake [cite: 47, 85]
ActivitySchema.index({ goalId: 1, userEmail: 1, questionId: 1 }, { unique: true }); 
ActivitySchema.index({ timestamp: 1 });

module.exports = mongoose.model("GroupMemberActivity", ActivitySchema);