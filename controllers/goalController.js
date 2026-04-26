const GroupGoal = require("../models/GroupGoal");
const StudyGroup = require("../models/StudyGroup");
const Subject = require("../models/Subject");

const createGoal = async (req, res) => {
    try {
        const groupId = req.params.id;
        const { title, subjects, targetCount, goalType, deadline, frequency } = req.body;

        const group = await StudyGroup.findById(groupId);
        if (!group) return res.status(404).json({ success: false, message: "Not found Group" });

        // Only creator check 
        if (group.creator.toString() !== req.user.userId.toString()) {
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

        const newGoal = await GroupGoal.create({
            group: groupId,
            title,
            subjects: subjectIds,
            targetCount,
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
module.exports = { createGoal, archiveIfExpired };