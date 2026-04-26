const GroupGoal = require("../models/GroupGoal");
const StudyGroup = require("../models/StudyGroup");
const Subject = require("../models/Subject");
const { sendSuccess, sendError } = require("../utils/response");
const { invalidatePattern } = require("../utils/cacheHelper");

// helper to check if a deadline goal has expired
// returns true if expired
const isGoalExpired = (goal) => {
  if (goal.goalType === "deadline" && goal.deadline) {
    return new Date(goal.deadline) < new Date();
  }
  return false;
};

// auto-archive expired goals - call this before doing anything goal-related
const archiveIfExpired = async (group) => {
  if (!group.activeGoal) return null;

  const goal = await GroupGoal.findById(group.activeGoal);
  if (!goal) return null;

  if (isGoalExpired(goal)) {
    goal.isActive = false;
    await goal.save();

    // clear the activeGoal reference on the group
    await StudyGroup.findByIdAndUpdate(group._id, { activeGoal: null });

    console.log(`Goal "${goal.title}" auto-archived because deadline passed`);
    return goal; // return the archived goal so caller knows what happened
  }

  return null;
};

// POST /groups/:id/goal - create a new goal for the group
const createGoal = async (req, res) => {
  try {
    const groupId = req.params.id;
    const userId = req.user._id;
    const { title, subjects, targetCount, metric, goalType, deadline, frequency } =
      req.body;

    // basic validation
    if (!title || !subjects || !targetCount) {
      return sendError(
        res,
        "Missing required fields",
        "MISSING_FIELDS",
        "title, subjects (array of subject names), and targetCount are required",
        400
      );
    }

    const group = await StudyGroup.findById(groupId);
    if (!group) {
      return sendError(res, "Group not found", "GROUP_NOT_FOUND", null, 404);
    }

    // only creator can add goals
    if (group.creator.toString() !== userId.toString()) {
      return sendError(
        res,
        "Only the group creator can add goals",
        "NOT_AUTHORIZED",
        null,
        403
      );
    }

    // check if there's an active goal - but first archive it if expired
    const archivedGoal = await archiveIfExpired(group);

    // re-fetch the group in case we just archived something
    const freshGroup = await StudyGroup.findById(groupId);

    if (freshGroup.activeGoal) {
      return sendError(
        res,
        "An active goal already exists for this group",
        "ACTIVE_GOAL_EXISTS",
        "Archive or wait for the current goal to expire before creating a new one",
        409
      );
    }

    // resolve subject names to IDs
    let subjectIds = [];
    for (const subjectName of subjects) {
      const subj = await Subject.findOne({ name: subjectName }).lean();
      if (!subj) {
        return sendError(
          res,
          `Subject "${subjectName}" not found`,
          "SUBJECT_NOT_FOUND",
          "Make sure the subject exists in the database",
          404
        );
      }
      subjectIds.push(subj._id);
    }

    // validate goalType + deadline/frequency combo
    const type = goalType || "deadline";

    if (type === "deadline" && !deadline) {
      return sendError(
        res,
        "Deadline is required for deadline-type goals",
        "MISSING_DEADLINE",
        null,
        400
      );
    }

    if (type === "recurring" && !frequency) {
      return sendError(
        res,
        "Frequency is required for recurring goals",
        "MISSING_FREQUENCY",
        "Specify 'daily' or 'weekly'",
        400
      );
    }

    // make sure deadline is in the future
    if (type === "deadline" && new Date(deadline) <= new Date()) {
      return sendError(
        res,
        "Deadline must be in the future",
        "INVALID_DEADLINE",
        null,
        400
      );
    }

    const newGoal = await GroupGoal.create({
      group: groupId,
      title: title.trim(),
      subjects: subjectIds,
      targetCount,
      metric: metric || "questionsSolved",
      goalType: type,
      deadline: type === "deadline" ? new Date(deadline) : null,
      frequency: type === "recurring" ? frequency : null,
      startDate: new Date(),
    });

    // link the goal to the group
    freshGroup.activeGoal = newGoal._id;
    await freshGroup.save();

    // populate subjects for response
    const populated = await GroupGoal.findById(newGoal._id)
      .populate("subjects", "name")
      .lean();

    return sendSuccess(
      res,
      "Goal created successfully",
      {
        goalId: populated._id,
        title: populated.title,
        subjects: populated.subjects.map((s) => s.name),
        targetCount: populated.targetCount,
        metric: populated.metric,
        goalType: populated.goalType,
        deadline: populated.deadline,
        frequency: populated.frequency,
        startDate: populated.startDate,
        progress: 0,
        isActive: true,
      },
      201
    );
  } catch (err) {
    console.log("Error creating goal:", err);
    return sendError(
      res,
      "Failed to create goal",
      "CREATE_GOAL_ERROR",
      err.message,
      500
    );
  }
};

// PUT /groups/:id/goal - edit the active goal (only creator)
const editGoal = async (req, res) => {
  try {
    const groupId = req.params.id;
    const userId = req.user._id;
    const { deadline, frequency, targetCount } = req.body;

    const group = await StudyGroup.findById(groupId);
    if (!group) {
      return sendError(res, "Group not found", "GROUP_NOT_FOUND", null, 404);
    }

    if (group.creator.toString() !== userId.toString()) {
      return sendError(
        res,
        "Only the creator can edit goals",
        "NOT_AUTHORIZED",
        null,
        403
      );
    }

    if (!group.activeGoal) {
      return sendError(
        res,
        "No active goal to edit",
        "NO_ACTIVE_GOAL",
        null,
        400
      );
    }

    const goal = await GroupGoal.findById(group.activeGoal);
    if (!goal) {
      return sendError(res, "Goal not found", "GOAL_NOT_FOUND", null, 404);
    }

    // update the fields that were provided
    if (deadline !== undefined) {
      if (new Date(deadline) <= new Date()) {
        return sendError(
          res,
          "New deadline must be in the future",
          "INVALID_DEADLINE",
          null,
          400
        );
      }
      goal.deadline = new Date(deadline);
    }

    if (frequency !== undefined) {
      goal.frequency = frequency;
    }

    if (targetCount !== undefined) {
      goal.targetCount = targetCount;
    }

    await goal.save();

    // bust the old leaderboard cache since goal params changed
    await invalidatePattern(`lb:${goal._id}:*`);
    await invalidatePattern(`progress:${goal._id}`);

    const updated = await GroupGoal.findById(goal._id)
      .populate("subjects", "name")
      .lean();

    return sendSuccess(res, "Goal updated successfully", {
      goalId: updated._id,
      title: updated.title,
      subjects: updated.subjects.map((s) => s.name),
      targetCount: updated.targetCount,
      deadline: updated.deadline,
      frequency: updated.frequency,
      isActive: updated.isActive,
    });
  } catch (err) {
    console.log("Something went wrong editing goal:", err);
    return sendError(
      res,
      "Failed to edit goal",
      "EDIT_GOAL_ERROR",
      err.message,
      500
    );
  }
};

module.exports = { createGoal, editGoal, archiveIfExpired };
