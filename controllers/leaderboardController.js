const mongoose = require("mongoose");
const GroupMemberActivity = require("../models/GroupMemberActivity");
const StudyGroup = require("../models/StudyGroup");
const GroupGoal = require("../models/GroupGoal");
const { sendSuccess, sendError } = require("../utils/response");
const { getCache, setCache } = require("../utils/cacheHelper");
const { archiveIfExpired } = require("./goalController");

// build the date filter based on timeWindow param
const buildDateFilter = (timeWindow) => {
  const now = new Date();

  if (timeWindow === "daily") {
    const startOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    return { $gte: startOfDay, $lte: now };
  }

  if (timeWindow === "weekly") {
    const dayOfWeek = now.getUTCDay();
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const startOfWeek = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + mondayOffset));
    return { $gte: startOfWeek, $lte: now };
  }

  return null;
};


// GET  leaderboard
const getLeaderboard = async (req, res) => {
  try {
    const groupId = req.params.id;
    const currentUserId = req.user._id;

    // parse query params with defaults
    const metric = req.query.metric || "solved";
    const sort = req.query.sort || "desc";
    const timeWindow = req.query.timeWindow || "all";
    const subjectFilter = req.query.subject || null;
    const offset = parseInt(req.query.offset) || 0;
    const limit = parseInt(req.query.limit) || 10;

    // find the group
    const group = await StudyGroup.findById(groupId).lean();
    if (!group) return sendError(res, "Group not found", "GROUP_NOT_FOUND", null, 404);

    // auto-archive check
    await archiveIfExpired(group);
    const freshGroup = await StudyGroup.findById(groupId).lean();

    if (!freshGroup.activeGoal) {
      return sendError(res, "No active goal for this group", "NO_ACTIVE_GOAL", "Create a goal first to see the leaderboard", 400);
    }

    const goal = await GroupGoal.findById(freshGroup.activeGoal).populate("subjects", "name").lean();
    if (!goal) return sendError(res, "Goal not found", "GOAL_NOT_FOUND", null, 404);

    // check cache first
    const cacheKey = `lb:${goal._id}:${metric}:${timeWindow}:${subjectFilter || "all"}:${sort}:${offset}:${limit}`;
    const cached = await getCache(cacheKey);
    if (cached) {
      const currentUserEntry = findCurrentUser(cached.fullBoard, currentUserId, goal);
      return sendSuccess(res, "Leaderboard (cached)", {
        goalId: goal._id,
        totalMembers: freshGroup.members.length,
        leaderboard: cached.page,
        currentUser: currentUserEntry,
        offset, limit,
      });
    }

    //Build the match filter
    let matchFilter = { goal: goal._id };

    // date filter
    const dateRange = buildDateFilter(timeWindow);
    if (dateRange) {
      matchFilter.activityDate = dateRange;
    }

    // subject filter
    if (subjectFilter && goal.subjects.length > 1) {
      const subjectNames = subjectFilter.split(",").map((s) => s.trim());
      const matchingSubjects = goal.subjects.filter((s) => subjectNames.includes(s.name));
      if (matchingSubjects.length > 0) {
        const subIds = matchingSubjects.map((s) => s._id);
        matchFilter.subject = { $in: subIds };
      }
    }

    // Aggregate activities grouped by user
    const pipeline = [
      { $match: matchFilter },
      {
        $group: {
          _id: "$user",
          solved: { $sum: 1 },
          totalTimeSpent: { $sum: "$timeSpent" },
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "_id",
          as: "userInfo",
        },
      },
      { $unwind: "$userInfo" },
      {
        $project: {
          _id: 0,
          userId: "$_id",
          user: "$userInfo.email",
          userName: "$userInfo.name",
          solved: 1,
          totalTimeSpent: 1,
          percentage: {
            $round: [{ $multiply: [{ $divide: ["$solved", goal.targetCount] }, 100] }, 2],
          },
        },
      },
    ];

    let results = await GroupMemberActivity.aggregate(pipeline);




    // Include members who have 0 activity
    const activeUserIds = results.map((r) => r.userId.toString());
    const User = require("../models/User");

    for (const memberId of freshGroup.members) {
      if (!activeUserIds.includes(memberId.toString())) {
        const memberInfo = await User.findById(memberId).lean();
        if (memberInfo) {
          results.push({
            userId: memberId,
            user: memberInfo.email,
            userName: memberInfo.name,
            solved: 0,
            totalTimeSpent: 0,
            percentage: 0,
          });
        }
      }
    }

    // Sort by the chosen metric
    let sortField = "solved";
    if (metric === "percentage") sortField = "percentage";
    if (metric === "timeSpent") sortField = "totalTimeSpent";
    if (metric === "userName") sortField = "userName";

    const sortDir = sort === "asc" ? 1 : -1;

    results.sort((a, b) => {
      const valA = a[sortField];
      const valB = b[sortField];
      if (typeof valA === "string") {
        return sortDir * valA.localeCompare(valB);
      }
      return sortDir * (valA - valB);
    });

    //Assign ranks (dense ranking - same score = same rank)
    let currentRank = 1;
    for (let i = 0; i < results.length; i++) {
      if (i === 0) {
        results[i].rank = currentRank;
      } else {
        // if this person has the same metric value as the previous, same rank
        const prevVal = results[i - 1][sortField];
        const currVal = results[i][sortField];
        if (prevVal === currVal) {
          results[i].rank = results[i - 1].rank;
        } else {
          currentRank = i + 1;
          results[i].rank = currentRank;
        }
      }
    }

    // full board for caching 
    const fullBoard = results.map((r) => ({
      userId: r.userId.toString(),
      user: r.user,
      userName: r.userName,
      solved: r.solved,
      totalTimeSpent: r.totalTimeSpent,
      percentage: r.percentage,
      rank: r.rank,
    }));


    const page = fullBoard.slice(offset, offset + limit);

    //Cache it
    let ttl = 300;
    if (goal.deadline) {
      const secondsUntilDeadline = Math.floor((new Date(goal.deadline) - new Date()) / 1000);
      if (secondsUntilDeadline > 0) {
        ttl = Math.min(ttl, secondsUntilDeadline);
      }
    }
    await setCache(cacheKey, { fullBoard, page }, ttl);

    // find current user
    const currentUserEntry = findCurrentUser(fullBoard, currentUserId, goal);

    return sendSuccess(res, "Leaderboard retrieved", {
      goalId: goal._id,
      totalMembers: freshGroup.members.length,
      leaderboard: page,
      currentUser: currentUserEntry,
      offset, limit,
    });
  } catch (err) {
    console.log("Something went wrong in the leaderboard logic:", err);
    return sendError(res, "Failed to get leaderboard", "LEADERBOARD_ERROR", err.message, 500);
  }
};

// find current user in the full board
function findCurrentUser(fullBoard, userId, goal) {
  const entry = fullBoard.find((e) => e.userId === userId.toString());
  if (entry) {
    return {
      user: entry.user,
      solved: entry.solved,
      totalTimeSpent: entry.totalTimeSpent,
      percentage: entry.percentage,
      rank: entry.rank,
    };
  }
  // user not found
  return null;
}

module.exports = { getLeaderboard };
