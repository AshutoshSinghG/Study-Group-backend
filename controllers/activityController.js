const GroupMemberActivity = require('../models/GroupMemberActivity');
const GroupGoal = require('../models/GroupGoal');
const Question = require('../models/Question');
const { client } = require('../utils/redisClient');

//Record solved question attempt
exports.recordActivity = async (req, res) => {
    try {
        const groupId = req.params.id;
        const { questionId, status, timeSpent } = req.body;
        const userEmail = req.user.email;

        //Check if a active goal exists
        const activeGoal = await GroupGoal.findOne({ groupId, isActive: true });
        if (!activeGoal) {
            return res.status(400).json({ success: false, message: "No active goal found for this group" });
        }

        //Deadline Check
        if (new Date() > activeGoal.deadline) {
            activeGoal.isActive = false;
            activeGoal.isArchived = true;
            await activeGoal.save();
            return res.status(400).json({ success: false, message: "Goal deadline has passed" });
        }

        //Question & Subject Check
        const question = await Question.findById(questionId);
        if (!question || !activeGoal.subjects.includes(question.subjectId)) {
            return res.status(400).json({
                success: false,
                message: "Question subject does not match the active group goal",
                error: { code: "INVALID_SUBJECT" }
            });
        }

        //Status Check
        if (status !== 'solved' && status !== 'correct') {
            return res.status(400).json({ success: false, message: "Only 'solved' or 'correct' status is counted" });
        }

        //De-duplication check (handled by unique index in schema)
        try {
            const activity = await GroupMemberActivity.create({
                groupId,
                goalId: activeGoal._id,
                userEmail,
                questionId,
                subjectId: question.subjectId,
                status,
                timeSpent
            });

            //REDIS INVALIDATION: Cache clear karna taaki leaderboard update ho sake
            await client.del(`leaderboard:${groupId}`);
            await client.del(`progress:${groupId}`);

            res.status(200).json({
                success: true,
                message: "Activity recorded",
                data: {
                    activityId: activity._id,
                    user: userEmail,
                    questionId: activity.questionId,
                    status: activity.status,
                    timestamp: activity.timestamp
                }
            });
        } catch (dbError) {
            if (dbError.code === 11000) { // Duplicate key error
                return res.status(400).json({ success: false, message: "Question already solved by user" });
            }
            throw dbError;
        }
    } catch (error) {
        res.status(500).json({ success: false, error: { details: error.message } });
    }
};