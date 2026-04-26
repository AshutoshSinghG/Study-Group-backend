const GroupMemberActivity = require("../models/GroupMemberActivity");
const GroupGoal = require("../models/GroupGoal");
const User = require("../models/User");
const { client } = require("../utils/redisClient");

const getLeaderboard = async (req, res) => {
    try {
        const groupId = req.params.id;
        const { metric = "solved", sort = "desc", offset = 0, limit = 10, timeWindow = "all" } = req.query;

        const cacheKey = `lb:${groupId}:${metric}:${timeWindow}:${offset}`;
        const cached = await client.get(cacheKey);
        if (cached) return res.status(200).json({ success: true, data: JSON.parse(cached) });

        const goal = await GroupGoal.findOne({ group: groupId, isActive: true });
        if (!goal) return res.status(404).json({ success: false, message: "No active goal" });

        // Time window filter
        let dateFilter = {};
        const now = new Date();
        if (timeWindow === "daily") {
            dateFilter = { activityDate: { $gte: new Date(now.setHours(0, 0, 0, 0)) } };
        } else if (timeWindow === "weekly") {
            const lastWeek = new Date(now.setDate(now.getDate() - 7));
            dateFilter = { activityDate: { $gte: lastWeek } };
        }

        // Aggregation
        const stats = await GroupMemberActivity.aggregate([
            { $match: { goal: goal._id, ...dateFilter } },
            {
                $group: {
                    _id: "$user",
                    solved: { $sum: 1 },
                    timeSpent: { $sum: "$timeSpent" }
                }
            },
            {
                $project: {
                    user: "$_id",
                    solved: 1,
                    timeSpent: 1,
                    percentage: { $round: [{ $multiply: [{ $divide: ["$solved", goal.targetCount] }, 100] }, 2] }
                }
            }
        ]);

        // Same metric = Same rank logic 
        const sortField = metric === "timeSpent" ? "timeSpent" : (metric === "percentage" ? "percentage" : "solved");
        stats.sort((a, b) => sort === "desc" ? b[sortField] - a[sortField] : a[sortField] - b[sortField]);

        let rank = 1;
        const rankedData = stats.map((item, i) => {
            if (i > 0 && item[sortField] !== stats[i - 1][sortField]) rank = i + 1;
            return { ...item, rank };
        });

        // Pagination 
        const pageData = rankedData.slice(Number(offset), Number(offset) + Number(limit));
        const currentUser = rankedData.find(u => u.user.toString() === req.user.userId.toString());

        const finalResponse = {
            goalId: goal._id,
            leaderboard: pageData,
            currentUser: currentUser || { user: req.user.email, rank: "N/A", solved: 0 },
            offset: Number(offset),
            limit: Number(limit)
        };

        await client.setEx(cacheKey, 300, JSON.stringify(finalResponse)); // 5 min cache 

        res.status(200).json({ success: true, data: finalResponse });
    } catch (err) {
        console.error("Leaderboard Error:", err);
        res.status(500).json({ success: false, message: "Leaderboard load nahi hua" });
    }
};

module.exports = { getLeaderboard };