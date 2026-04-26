const mongoose = require("mongoose");

const QuestionSchema = new mongoose.Schema({
    text: { 
        type: String, 
        required: true 
    },
    subjectId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: "Subject", 
        required: true 
    },
    topic: { 
        type: String 
    },
    difficulty: { 
        type: String, 
        enum: ["easy", "medium", "hard"], 
        default: "medium" 
    },
    createdAt: { 
        type: Date, 
        default: Date.now 
    }
});

QuestionSchema.index({ subjectId: 1 });

module.exports = mongoose.model("Question", QuestionSchema);