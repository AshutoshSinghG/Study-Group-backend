const GroupMemberActivity = require("../models/GroupMemberActivity");
const StudyGroup = require("../models/StudyGroup");
const GroupGoal = require("../models/GroupGoal");
const User = require("../models/User");
const { sendSuccess, sendError } = require("../utils/response");
const { getCache, setCache } = require("../utils/cacheHelper");
const { archiveIfExpired } = require("./goalController");
const { getCurrentWindow } = require("./activityController");

// GET /groups/:id/progress
const getProgress = async (req, res) => {
  try {
    const groupId = req.params.id;

    const group = await StudyGroup.findById(groupId).lean();
    if (!group) {
      return sendError(res, "Group not found", "GROUP_NOT_FOUND", null, 404);
    }

    // auto-archive if needed
    await archiveIfExpired(group);
    const freshGroup = await StudyGroup.findById(groupId).lean();

    if (!freshGroup.activeGoal) {
      return sendError(res, "No active goal for this group", "NO_ACTIVE_GOAL", null, 400);
    }

    const goal = await GroupGoal.findById(freshGroup.activeGoal)
      .populate("subjects", "name")
      .lean();

    if (!goal) {
      return sendError(res, "Goal not found", "GOAL_NOT_FOUND", null, 404);
    }

    // check cache
    const cacheKey = `progress:${goal._id}`;
    const cached = await getCache(cacheKey);
    if (cached) {
      return sendSuccess(res, "Group progress (cached)", cached);
    }

    // for recurring goals, only count activities in the current window
    const { windowStart, windowEnd } = getCurrentWindow(goal);

    let dateMatch = {};
    if (goal.goalType === "recurring") {
      dateMatch = { activityDate: { $gte: windowStart, $lte: windowEnd } };
    }

    // get per-member breakdown
    const memberStats = await GroupMemberActivity.aggregate([
      {
        $match: {
          goal: goal._id,
          ...dateMatch,
        },
      },
      {
        $group: {
          _id: "$user",
          solved: { $sum: 1 },
          timeSpent: { $sum: "$timeSpent" },
        },
      },
    ]);

    // map user IDs to emails
    let perMemberProgress = [];
    let totalSolved = 0;
    let totalTime = 0;

    for (const stat of memberStats) {
      const userInfo = await User.findById(stat._id).lean();
      perMemberProgress.push({
        user: userInfo ? userInfo.email : "unknown",
        solved: stat.solved,
        timeSpent: stat.timeSpent,
      });
      totalSolved += stat.solved;
      totalTime += stat.timeSpent;
    }

    // add members with zero progress
    const activeMemberIds = memberStats.map((s) => s._id.toString());
    for (const memberId of freshGroup.members) {
      if (!activeMemberIds.includes(memberId.toString())) {
        const memberInfo = await User.findById(memberId).lean();
        if (memberInfo) {
          perMemberProgress.push({
            user: memberInfo.email,
            solved: 0,
            timeSpent: 0,
          });
        }
      }
    }

    // FIXME: for timeSpent metric, "totalQuestions" doesn't make sense as a label
    // but keeping it for now since the spec uses this format
    const progressPercentage = Math.round((totalSolved / goal.targetCount) * 100);

    const progressData = {
      goalId: goal._id,
      title: goal.title,
      subjects: goal.subjects.map((s) => s.name),
      totalQuestions: goal.targetCount,
      questionsSolved: totalSolved,
      progressPercentage: Math.min(progressPercentage, 100), // cap at 100
      totalTimeSpent: totalTime,
      perMemberProgress,
    };

    // cache it - TTL similar to leaderboard
    let ttl = 300;
    if (goal.deadline) {
      const secsLeft = Math.floor((new Date(goal.deadline) - new Date()) / 1000);
      if (secsLeft > 0) ttl = Math.min(ttl, secsLeft);
    }
    await setCache(cacheKey, progressData, ttl);

    return sendSuccess(res, "Group progress retrieved", progressData);
  } catch (err) {
    console.log("Error getting progress:", err);
    return sendError(res, "Failed to get progress", "PROGRESS_ERROR", err.message, 500);
  }
};

module.exports = { getProgress };
