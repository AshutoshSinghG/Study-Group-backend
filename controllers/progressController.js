const GroupMemberActivity = require('../models/GroupMemberActivity');
const GroupGoal = require('../models/GroupGoal');

exports.getGroupProgress = async (req, res) => {
    try {
        const group = req.params.id;
        const activeGoal = await GroupGoal.findOne({ group, isActive: true });

        if (!activeGoal) return res.status(404).json({ success: false, message: "No active goal" });

        const stats = await GroupMemberActivity.aggregate([
            { $match: { goalId: activeGoal._id } },
            {
                $group: {
                    _id: "$userEmail",
                    solved: { $sum: 1 }
                }
            }
        ]);

        const totalSolved = stats.reduce((acc, curr) => acc + curr.solved, 0);
        const progressPercentage = (totalSolved / activeGoal.targetValue) * 100;

        res.status(200).json({
            success: true,
            data: {
                goalId: activeGoal._id,
                title: activeGoal.title,
                totalQuestions: activeGoal.targetValue,
                questionsSolved: totalSolved,
                progressPercentage: Math.min(progressPercentage, 100),
                perMemberProgress: stats.map(s => ({ user: s._id, solved: s.solved }))
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: { details: error.message } });
    }
};