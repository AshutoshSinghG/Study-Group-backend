const StudyGroup = require("../models/StudyGroup");
const User = require("../models/User");
const GroupGoal = require("../models/GroupGoal");
const GroupMemberActivity = require("../models/GroupMemberActivity");
const Subject = require("../models/Subject");
const Question = require("../models/Question");
const { invalidateGroupCache, generateLeaderboardKey, cacheGet, cacheSet, generateProgressKey } = require("../services/cacheService");

exports.createGroup = async (req, res, next) => {
  try {
    const { name, members = [] } = req.body;
    const creatorId = req.user._id;

    // Check if user is already a creator
    const existingGroup = await StudyGroup.findOne({ creator: creatorId });
    if (existingGroup) {
      return res.status(409).json({
        success: false,
        message: "User is already a creator of a group",
        data: null,
        error: { code: "ALREADY_CREATOR", details: "A user can only create one group at a time." }
      });
    }

    let memberIds = [creatorId];
    if (members && members.length > 0) {
      const users = await User.find({ email: { $in: members } });
      users.forEach(u => {
        if (u._id.toString() !== creatorId.toString()) {
          memberIds.push(u._id);
        }
      });
    }

    const newGroup = new StudyGroup({
      name,
      creator: creatorId,
      members: memberIds
    });
    await newGroup.save();

    const populatedGroup = await StudyGroup.findById(newGroup._id).populate("creator", "email").populate("members", "email");

    res.status(201).json({
      success: true,
      message: "Group created successfully",
      data: {
        groupId: populatedGroup._id,
        name: populatedGroup.name,
        creator: populatedGroup.creator.email,
        members: populatedGroup.members.map(m => m.email),
        activeGoal: null,
        createdAt: populatedGroup.createdAt
      },
      error: null
    });
  } catch (error) {
    next(error);
  }
};

exports.addMember = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { email } = req.body;

    const group = await StudyGroup.findById(id).populate("members", "email");
    if (!group) {
      return res.status(404).json({ success: false, message: "Group not found", data: null, error: { code: "NOT_FOUND" }});
    }

    if (group.creator.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: "Only creator can add members", data: null, error: { code: "FORBIDDEN" }});
    }

    const isMember = group.members.some(m => m.email === email);
    if (isMember) {
      return res.status(409).json({
        success: false,
        message: "User is already a member of this group",
        data: null,
        error: { code: "USER_ALREADY_MEMBER", details: `The email ${email} is already part of this group.` }
      });
    }

    const newUser = await User.findOne({ email });
    if (!newUser) {
      return res.status(404).json({ success: false, message: "User to add not found", data: null, error: { code: "NOT_FOUND" }});
    }

    group.members.push(newUser._id);
    await group.save();

    const populatedGroup = await StudyGroup.findById(id).populate("members", "email");

    res.status(200).json({
      success: true,
      message: "Member added successfully",
      data: {
        groupId: populatedGroup._id,
        members: populatedGroup.members.map(m => m.email)
      },
      error: null
    });
  } catch (error) {
    next(error);
  }
};

exports.addGoal = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { title, subject, metric, deadline, target = 100, frequency = "once" } = req.body;

    const group = await StudyGroup.findById(id);
    if (!group) {
      return res.status(404).json({ success: false, message: "Group not found", data: null, error: { code: "NOT_FOUND" }});
    }

    if (group.creator.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: "Only creator can add goals", data: null, error: { code: "FORBIDDEN" }});
    }

    if (group.activeGoal) {
      // Check if active goal is still active
      const currentGoal = await GroupGoal.findById(group.activeGoal);
      if (currentGoal && currentGoal.isActive) {
        if (new Date() < new Date(currentGoal.deadline)) {
          return res.status(409).json({
            success: false,
            message: "An active goal already exists for this group",
            data: null,
            error: { code: "ACTIVE_GOAL_EXISTS" }
          });
        } else {
          // Archive it
          currentGoal.isActive = false;
          await currentGoal.save();
        }
      }
    }

    // Resolve subjects
    let subjectIds = [];
    if (subject) {
      const subjectNames = subject.split(",").map(s => s.trim());
      const subjects = await Subject.find({ name: { $in: subjectNames } });
      subjectIds = subjects.map(s => s._id);
    }

    const newGoal = new GroupGoal({
      groupId: group._id,
      title,
      subjects: subjectIds,
      metric,
      deadline,
      target,
      frequency,
      isActive: true
    });
    await newGoal.save();

    group.activeGoal = newGoal._id;
    await group.save();

    await invalidateGroupCache(group._id.toString());

    res.status(201).json({
      success: true,
      message: "Goal added successfully",
      data: {
        goalId: newGoal._id,
        title: newGoal.title,
        subject: subject,
        metric: newGoal.metric,
        deadline: newGoal.deadline,
        progress: 0,
        isActive: newGoal.isActive
      },
      error: null
    });
  } catch (error) {
    next(error);
  }
};

exports.recordActivity = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { questionId, status, timeSpent } = req.body;
    const userId = req.user._id;

    const group = await StudyGroup.findById(id).populate("activeGoal");
    if (!group) return res.status(404).json({ success: false, message: "Group not found", data: null, error: { code: "NOT_FOUND" }});
    if (!group.members.includes(userId)) return res.status(403).json({ success: false, message: "Not a member of this group", data: null, error: { code: "FORBIDDEN" }});

    const activeGoal = group.activeGoal;
    if (!activeGoal || !activeGoal.isActive) {
      return res.status(400).json({ success: false, message: "No active goal for this group", data: null, error: { code: "NO_ACTIVE_GOAL" }});
    }

    if (new Date() > new Date(activeGoal.deadline)) {
      activeGoal.isActive = false;
      await activeGoal.save();
      return res.status(400).json({ success: false, message: "Goal deadline has passed", data: null, error: { code: "DEADLINE_PASSED" }});
    }

    const question = await Question.findById(questionId);
    if (!question) return res.status(404).json({ success: false, message: "Question not found", data: null, error: { code: "NOT_FOUND" }});

    const isValidSubject = activeGoal.subjects.some(subId => subId.toString() === question.subjectId.toString());
    if (!isValidSubject) {
      return res.status(400).json({ success: false, message: "Question subject does not match the active group goal.", data: null, error: { code: "SUBJECT_MISMATCH" }});
    }

    if (status === "solved" || status === "correct") {
      const existing = await GroupMemberActivity.findOne({
        goalId: activeGoal._id,
        user: userId,
        questionId: question._id,
        status: { $in: ["solved", "correct"] }
      });

      if (existing) {
        return res.status(400).json({ success: false, message: "Duplicate per-user attempt", data: null, error: { code: "DUPLICATE_ATTEMPT" }});
      }
    }

    const activity = new GroupMemberActivity({
      groupId: group._id,
      goalId: activeGoal._id,
      user: userId,
      questionId: question._id,
      subjectId: question.subjectId,
      status,
      timeSpent
    });
    await activity.save();

    await invalidateGroupCache(group._id.toString());

    res.status(200).json({
      success: true,
      message: "Activity recorded",
      data: {
        activityId: activity._id,
        user: req.user.email,
        questionId: activity.questionId,
        status: activity.status,
        timeSpent: activity.timeSpent,
        timestamp: activity.timestamp
      },
      error: null
    });
  } catch (error) {
    next(error);
  }
};

exports.getLeaderboard = async (req, res, next) => {
  try {
    const { id } = req.params;
    let { metric = "questionsSolved", subject, timeWindow = "all", sort = "desc", offset = 0, limit = 10 } = req.query;
    offset = parseInt(offset, 10) || 0;
    limit = parseInt(limit, 10) || 10;

    const cacheKey = generateLeaderboardKey(id, req.query);
    const cachedData = await cacheGet(cacheKey);
    if (cachedData) {
      return res.status(200).json(cachedData);
    }

    const group = await StudyGroup.findById(id).populate("activeGoal");
    if (!group) return res.status(404).json({ success: false, message: "Group not found", data: null, error: { code: "NOT_FOUND" }});
    
    const activeGoal = group.activeGoal;
    if (!activeGoal) return res.status(400).json({ success: false, message: "No active goal", data: null, error: { code: "NO_ACTIVE_GOAL" }});

    const matchQuery = { goalId: activeGoal._id, status: { $in: ["solved", "correct"] } };

    // Apply time window filter
    if (timeWindow === "daily") {
      const startOfDay = new Date();
      startOfDay.setUTCHours(0,0,0,0);
      matchQuery.timestamp = { $gte: startOfDay };
    } else if (timeWindow === "weekly") {
      const startOfWeek = new Date();
      startOfWeek.setUTCDate(startOfWeek.getUTCDate() - startOfWeek.getUTCDay());
      startOfWeek.setUTCHours(0,0,0,0);
      matchQuery.timestamp = { $gte: startOfWeek };
    }

    // Apply subject filter if multi-subject
    if (subject) {
      const subjectDocs = await Subject.find({ name: { $in: subject.split(",") } });
      matchQuery.subjectId = { $in: subjectDocs.map(s => s._id) };
    }

    const agg = [
      { $match: matchQuery },
      { $group: {
          _id: "$user",
          questionsSolved: { $sum: 1 },
          timeSpent: { $sum: "$timeSpent" }
        }
      },
      { $lookup: { from: "users", localField: "_id", foreignField: "_id", as: "userInfo" } },
      { $unwind: "$userInfo" },
      { $project: {
          user: "$userInfo.email",
          solved: "$questionsSolved",
          timeSpent: "$timeSpent",
          percentage: { $multiply: [{ $divide: ["$questionsSolved", activeGoal.target || 100] }, 100] }
        }
      }
    ];

    let sortField = "solved";
    if (metric === "timeSpent") sortField = "timeSpent";
    else if (metric === "percentage") sortField = "percentage";

    agg.push({ $sort: { [sortField]: sort === "asc" ? 1 : -1 } });

    const results = await GroupMemberActivity.aggregate(agg);

    // Calculate Ranks
    let currentRank = 1;
    let currentUserData = null;
    
    const leaderboardWithRanks = results.map((r, index) => {
      // Same metric = same rank logic
      if (index > 0 && results[index][sortField] !== results[index - 1][sortField]) {
        currentRank = index + 1;
      }
      const data = {
        user: r.user,
        solved: r.solved,
        percentage: r.percentage,
        timeSpent: r.timeSpent,
        rank: currentRank
      };
      
      if (r._id && r._id.toString() === req.user._id.toString()) {
        currentUserData = data;
      }
      return data;
    });

    if (!currentUserData) {
      currentUserData = { user: req.user.email, solved: 0, percentage: 0, timeSpent: 0, rank: null };
    }

    const paginatedLeaderboard = leaderboardWithRanks.slice(offset, offset + limit);

    const responsePayload = {
      success: true,
      message: "Leaderboard fetched successfully",
      data: {
        goalId: activeGoal._id,
        totalMembers: group.members.length,
        leaderboard: paginatedLeaderboard,
        currentUser: currentUserData,
        offset,
        limit
      },
      error: null
    };

    await cacheSet(cacheKey, responsePayload, 300); // 5 mins cache

    res.status(200).json(responsePayload);
  } catch (error) {
    next(error);
  }
};

exports.getProgress = async (req, res, next) => {
  try {
    const { id } = req.params;

    const group = await StudyGroup.findById(id).populate("activeGoal");
    if (!group) return res.status(404).json({ success: false, message: "Group not found", data: null, error: { code: "NOT_FOUND" }});
    
    const activeGoal = group.activeGoal;
    if (!activeGoal) return res.status(400).json({ success: false, message: "No active goal", data: null, error: { code: "NO_ACTIVE_GOAL" }});

    const cacheKey = generateProgressKey(id, activeGoal._id.toString());
    const cachedData = await cacheGet(cacheKey);
    if (cachedData) {
      return res.status(200).json(cachedData);
    }

    const matchQuery = { goalId: activeGoal._id, status: { $in: ["solved", "correct"] } };

    const agg = [
      { $match: matchQuery },
      { $group: {
          _id: "$user",
          questionsSolved: { $sum: 1 }
        }
      },
      { $lookup: { from: "users", localField: "_id", foreignField: "_id", as: "userInfo" } },
      { $unwind: "$userInfo" },
      { $project: {
          user: "$userInfo.email",
          solved: "$questionsSolved"
        }
      }
    ];

    const results = await GroupMemberActivity.aggregate(agg);

    let totalSolved = 0;
    const perMemberProgress = results.map(r => {
      totalSolved += r.solved;
      return { user: r.user, solved: r.solved };
    });

    const totalQuestions = activeGoal.target || 100;
    const progressPercentage = Math.min((totalSolved / totalQuestions) * 100, 100);

    const subjects = await Subject.find({ _id: { $in: activeGoal.subjects } });

    const responsePayload = {
      success: true,
      message: "Progress fetched successfully",
      data: {
        goalId: activeGoal._id,
        title: activeGoal.title,
        subject: subjects.map(s => s.name).join(", "),
        totalQuestions,
        questionsSolved: totalSolved,
        progressPercentage,
        perMemberProgress
      },
      error: null
    };

    await cacheSet(cacheKey, responsePayload, 300);

    res.status(200).json(responsePayload);
  } catch (error) {
    next(error);
  }
};
