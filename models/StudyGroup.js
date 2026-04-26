const mongoose = require("mongoose");

const StudyGroupSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, "Group name is required"],
        trim: true
    },
    creator: {
        type: String, // Hum creator ki email ya ID store karenge
        required: true,
        ref: "User"
    },
    members: [{
        type: String, // Member emails ki list
        ref: "User"
    }],
    activeGoal: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "GroupGoal",
        default: null
    },
    createdAt: {
        type: Date,
        default: Date.now // UTC by default [cite: 86]
    }
});

// Indexing for faster lookups
StudyGroupSchema.index({ creator: 1 });
StudyGroupSchema.index({ members: 1 });

module.exports = mongoose.model("StudyGroup", StudyGroupSchema);