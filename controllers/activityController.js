const GroupMemberActivity = require("../models/GroupMemberActivity");
const GroupGoal = require("../models/GroupGoal");
const Question = require("../models/Question");
const { client } = require("../utils/redisClient");

const recordActivity = async (req, res) => {
    try {
        const { questionId, status, timeSpent } = req.body;
        const userId = req.user.userId;
        const groupId = req.params.id;

        const goal = await GroupGoal.findOne({ group: groupId, isActive: true });
        if (!goal) return res.status(400).json({ success: false, message: "No active goal found" });

        // Status check: only solved/correct 
        if (!["solved", "correct"].includes(status)) {
            return res.status(400).json({ success: false, message: "Attempt status is not valid" });
        }

        // Time window check 
        const now = new Date();
        if (goal.deadline && now > new Date(goal.deadline)) {
            return res.status(400).json({ success: false, message: "Goal is archive" });
        }

        const question = await Question.findById(questionId);
        if (!question) return res.status(404).json({ success: false, message: "Question not found" });

        // Subject match check 
        if (!goal.subjects.includes(question.subjectId.toString())) {
            return res.status(400).json({ success: false, message: "This subject is not in this goal" });
        }

        // Unique attempt check
        const alreadyDone = await GroupMemberActivity.findOne({
            goal: goal._id,
            user: userId,
            questionId: questionId
        });

        if (alreadyDone) {
            return res.status(409).json({ success: false, message: "You are already solved this question" });
        }

        const activity = await GroupMemberActivity.create({
            group: groupId,
            goal: goal._id,
            user: userId,
            questionId,
            subject: question.subjectId,
            status,
            timeSpent,
            activityDate: now
        });

        const keys = await client.keys(`lb:${groupId}:*`);
        if (keys.length > 0) await client.del(keys);
        await client.del(`progress:${groupId}`);

        res.status(200).json({ success: true, message: "Activity recorded successfully", data: activity });
    } catch (err) {
        console.log("Activity error logic:", err);
        res.status(500).json({ success: false, message: "Server error" });
    }
};

module.exports = { recordActivity };