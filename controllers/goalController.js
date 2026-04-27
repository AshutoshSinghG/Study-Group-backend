const GroupGoal = require("../models/GroupGoal");
const StudyGroup = require("../models/StudyGroup");
const Subject = require("../models/Subject");
const { client } = require('../utils/redisClient')

const createGoal = async (req, res) => {
    try {
        const groupId = req.params.id;
        const { title, subjects, targetCount, metric, goalType, deadline, frequency } = req.body;

        const group = await StudyGroup.findById(groupId);
        if (!group) return res.status(404).json({ success: false, message: "Not found Group" });

        // Only creator check 
        if (group.creator.toLowerCase() !== req.user.email.toLowerCase()) {
            return res.status(403).json({ success: false, message: "Only creator can set goals" });
        }

        // Ek waqt pe ek hi active goal 
        const existingGoal = await GroupGoal.findOne({ group: groupId, isActive: true });
        if (existingGoal) {
            return res.status(409).json({ success: false, message: "one goal active alredy" });
        }

        // Resolve subject names to IDs 
        const subjectDocs = await Subject.find({ name: { $in: subjects } });
        const subjectIds = subjectDocs.map(s => s._id);

        if (subjectDocs.length === 0) {
            console.log("Warning: No subjects found in DB for names:", subjects);
        }

        const newGoal = await GroupGoal.create({
            group: groupId,
            title,
            subjects: subjectIds,
            targetCount,
            metric,
            goalType: goalType || "deadline",
            deadline: deadline ? new Date(deadline) : null,
            frequency: frequency || "none",
            isActive: true,
            startDate: new Date()
        });

        group.activeGoal = newGoal._id;
        await group.save();

        res.status(201).json({ success: true, message: "Goal created successfully", data: newGoal });
    } catch (err) {
        console.error("Goal Error:", err);
        res.status(500).json({ success: false, message: "Error creating goal" });
    }
};


const archiveIfExpired = async (group) => {
    if (!group.activeGoal) return null;

    const goal = await GroupGoal.findById(group.activeGoal);
    if (!goal) return null;

    const now = new Date();

    // Deadline Type Logic
    if (goal.goalType === "deadline" && goal.deadline && now > new Date(goal.deadline)) {
        goal.isActive = false;
        await goal.save();

        // Group archive goal
        await StudyGroup.findByIdAndUpdate(group._id, { activeGoal: null });
        console.log(`[System]: Goal "${goal.title}" is expired`);
        return null;
    }

    return goal;
};

// Edit the active goal (Only for Group Creator)
const editGoal = async (req, res) => {
    try {
        const groupId = req.params.id;
        const email = req.user.email;
        const { title, deadline, targetCount, frequency } = req.body;

        const group = await StudyGroup.findById(groupId);
        if (!group) return res.status(404).json({ success: false, message: "Group not found" });

        // check only creator
        if (group.creator.toLowerCase() !== email.toLowerCase()) {
            return res.status(403).json({ success: false, message: "only group creator can edit" });
        }

        //Active Goal Check
        if (!group.activeGoal) {
            return res.status(400).json({ success: false, message: "not found active goal" });
        }

        const goal = await GroupGoal.findById(group.activeGoal);
        if (!goal) return res.status(404).json({ success: false, message: "not faund goal data" });

        //Update Fields
        if (title) goal.title = title;
        if (targetCount) goal.targetCount = targetCount;
        if (frequency) goal.frequency = frequency;

        if (deadline) {
            if (new Date(deadline) <= new Date()) {
                return res.status(400).json({ success: false, message: "deadline passed" });
            }
            goal.deadline = new Date(deadline);
        }

        await goal.save();

        //chane Leaderboard Chache
        const keys = await client.keys(`lb:${groupId}:*`);
        if (keys.length > 0) await client.del(keys);
        await client.del(`progress:${groupId}`);

        return res.status(200).json({
            success: true,
            message: "Goal update ho gaya aur leaderboard refresh kar diya gaya",
            data: goal
        });

    } catch (err) {
        console.error("Edit Goal Error:", err.message);
        res.status(500).json({ success: false, message: "Server error during edit" });
    }
};
module.exports = { createGoal, archiveIfExpired, editGoal };