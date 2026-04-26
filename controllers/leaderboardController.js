const GroupMemberActivity = require('../models/GroupMemberActivity');
const GroupGoal = require('../models/GroupGoal');
const { client } = require('../utils/redisClient');

exports.getLeaderboard = async (req, res) => {
    try {
        const groupId = req.params.id;
        const { metric = 'questionsSolved', timeWindow = 'all', limit = 10, offset = 0 } = req.query;
        const cacheKey = `leaderboard:${groupId}:${metric}:${timeWindow}:${offset}`;

        //Redis Cache check
        const cachedData = await client.get(cacheKey);
        if (cachedData) {
            return res.status(200).json(JSON.parse(cachedData));
        }

        const activeGoal = await GroupGoal.findOne({ groupId, isActive: true });
        if (!activeGoal) return res.status(404).json({ success: false, message: "No active goal" });

        //Aggregation Pipeline
        let matchStage = { goalId: activeGoal._id };
        
        // Time Window Filter logic
        if (timeWindow !== 'all') {
            const now = new Date();
            const start = new Date();
            if (timeWindow === 'daily') start.setHours(0,0,0,0);
            else if (timeWindow === 'weekly') start.setDate(now.getDate() - 7);
            matchStage.timestamp = { $gte: start };
        }

        const leaderboardData = await GroupMemberActivity.aggregate([
            { $match: matchStage },
            {
                $group: {
                    _id: "$userEmail",
                    solved: { $sum: 1 },
                    timeSpent: { $sum: "$timeSpent" }
                }
            },
            {
                $project: {
                    user: "$_id",
                    solved: 1,
                    timeSpent: 1,
                    percentage: { $multiply: [{ $divide: ["$solved", activeGoal.targetValue] }, 100] }
                }
            },
            { $sort: { [metric === 'timeSpent' ? 'timeSpent' : 'solved']: -1 } }
        ]);

        //Ranking Logic (Same metric = Same rank)
        let currentRank = 1;
        const rankedList = leaderboardData.map((entry, index, list) => {
            if (index > 0 && entry[metric === 'timeSpent' ? 'timeSpent' : 'solved'] < list[index-1][metric === 'timeSpent' ? 'timeSpent' : 'solved']) {
                currentRank = index + 1;
            }
            return { ...entry, rank: currentRank };
        });

        //Current User Rank [cite: 87]
        const currentUserStats = rankedList.find(u => u.user === req.user.email) || { user: req.user.email, solved: 0, percentage: 0, rank: "N/A" };

        const response = {
            success: true,
            message: "Leaderboard fetched successfully",
            data: {
                goalId: activeGoal._id,
                totalMembers: rankedList.length,
                leaderboard: rankedList.slice(Number(offset), Number(offset) + Number(limit)),
                currentUser: currentUserStats,
                offset: Number(offset),
                limit: Number(limit)
            }
        };

        // Cache result for 5 minutes
        await client.setEx(cacheKey, 300, JSON.stringify(response));

        res.status(200).json(response);
    } catch (error) {
        res.status(500).json({ success: false, error: { details: error.message } });
    }
};