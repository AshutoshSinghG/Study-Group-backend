const GroupMemberActivity = require("../models/GroupMemberActivity");
const StudyGroup = require("../models/StudyGroup");
const GroupGoal = require("../models/GroupGoal");
const Question = require("../models/Question");
const { sendSuccess, sendError } = require("../utils/response");
const { invalidatePattern } = require("../utils/cacheHelper");
const { archiveIfExpired } = require("./goalController");

// figure out the current valid time window for a goal
const getCurrentWindow = (goal) => {
  const now = new Date();
  const start = new Date(goal.startDate);

  if (goal.goalType === "recurring" && goal.frequency === "daily") {
    const windowStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const windowEnd = new Date(windowStart);
    windowEnd.setUTCDate(windowEnd.getUTCDate() + 1);
    return { windowStart, windowEnd };
  }



  if (goal.goalType === "recurring" && goal.frequency === "weekly") {
    const dayOfWeek = now.getUTCDay();
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const windowStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + mondayOffset));
    const windowEnd = new Date(windowStart);
    windowEnd.setUTCDate(windowEnd.getUTCDate() + 7);
    return { windowStart, windowEnd };
  }

  // deadline type
  return { windowStart: start, windowEnd: goal.deadline ? new Date(goal.deadline) : now };
};


// Activity Record 
const recordActivity = async (req, res) => {
  try {
    const groupId = req.params.id;
    const userId = req.user._id;
    const { questionId, status, timeSpent } = req.body;

    if (!questionId || !status || timeSpent === undefined) {
      return sendError(res, "Missing required fields", "MISSING_FIELDS", "questionId, status, and timeSpent are required", 400);
    }

    if (!["solved", "correct"].includes(status)) {
      return sendError(res, "Invalid status", "INVALID_STATUS", "Status must be 'solved' or 'correct'", 400);
    }

    const group = await StudyGroup.findById(groupId);
    if (!group) return sendError(res, "Group not found", "GROUP_NOT_FOUND", null, 404);

    const isMember = group.members.some((mid) => mid.toString() === userId.toString());
    if (!isMember) return sendError(res, "You are not a member of this group", "NOT_A_MEMBER", null, 403);




    // auto-archive if goal expired
    await archiveIfExpired(group);
    const freshGroup = await StudyGroup.findById(groupId);

    if (!freshGroup.activeGoal) {
      return sendError(res, "No active goal for this group", "NO_ACTIVE_GOAL", "The group needs an active goal before submitting activities", 400);
    }

    const goal = await GroupGoal.findById(freshGroup.activeGoal);
    if (!goal || !goal.isActive) {
      return sendError(res, "Goal has expired, creator should add a new goal", "GOAL_EXPIRED", null, 400);
    }
    // fetch question to verify subject
    const question = await Question.findById(questionId).lean();
    if (!question) return sendError(res, "Question not found", "QUESTION_NOT_FOUND", null, 404);



    const qSubject = question.subjectId.toString();
    const goalSubjects = goal.subjects.map((s) => s.toString());
    if (!goalSubjects.includes(qSubject)) {
      return sendError(res, "Question subject does not match the active group goal", "SUBJECT_MISMATCH", null, 400);
    }

    // check time window
    const activityTimestamp = new Date();
    const { windowStart, windowEnd } = getCurrentWindow(goal);

    if (activityTimestamp < windowStart || activityTimestamp > windowEnd) {
      return sendError(res, "Activity is outside the goal's time window", "OUTSIDE_TIME_WINDOW", `Valid: ${windowStart.toISOString()} to ${windowEnd.toISOString()}`, 400);
    }

    // try to insert - unique index catches dupes
    let activity;
    try {
      activity = await GroupMemberActivity.create({
        group: groupId, goal: goal._id, user: userId,
        questionId, subject: question.subjectId,
        status, timeSpent, activityDate: activityTimestamp,
      });
    } catch (dupErr) {
      if (dupErr.code === 11000) {
        return sendError(res, "You already submitted this question for the current goal", "DUPLICATE_ACTIVITY", "Each question counts once per user per goal", 409);
      }
      throw dupErr;
    }


    // bust cache for this goal
    await invalidatePattern(`lb:${goal._id}:*`);
    await invalidatePattern(`progress:${goal._id}`);

    const populated = await GroupMemberActivity.findById(activity._id).populate("user", "email").lean();

    return sendSuccess(res, "Activity recorded successfully", {
      activityId: populated._id, user: populated.user.email,
      questionId: populated.questionId, status: populated.status,
      timeSpent: populated.timeSpent, timestamp: populated.activityDate,
    });
  } catch (err) {
    console.log("Something went wrong recording activity:", err);
    return sendError(res, "Failed to record activity", "RECORD_ACTIVITY_ERROR", err.message, 500);
  }
};

module.exports = { recordActivity, getCurrentWindow };
