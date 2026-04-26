const mongoose = require("mongoose");

const StudyGroupSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, "Group name is required"],
        trim: true
    },
    creator: {
        type: String,
        required: true,
        ref: "User"
    },
    members: [{
        type: String,
        ref: "User"
    }],
    activeGoal: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "GroupGoal",
        default: null
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

StudyGroupSchema.index({ creator: 1 });
StudyGroupSchema.index({ members: 1 });

module.exports = mongoose.model("StudyGroup", StudyGroupSchema);