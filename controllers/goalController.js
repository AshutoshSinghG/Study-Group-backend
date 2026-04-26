const GroupGoal = require('../models/GroupGoal');
const StudyGroup = require('../models/StudyGroup');

//Add a new group goal
exports.addGroupGoal = async (req, res) => {
    try {
        const groupId = req.params.id;
        const { title, subject, metric, deadline, targetValue, isRecurring, frequency } = req.body;

        const group = await StudyGroup.findById(groupId);
        if (!group) {
            return res.status(404).json({ success: false, message: "Group not found" });
        }

        //Only creator can set goals
        if (group.creator !== req.user.email) {
            return res.status(403).json({ success: false, message: "Only creator can set goals" });
        }

        // Check for existing active goal
        const activeGoal = await GroupGoal.findOne({ groupId, isActive: true });
        if (activeGoal) {
            return res.status(409).json({
                success: false,
                message: "An active goal already exists for this group",
                data: null,
                error: { code: "ACTIVE_GOAL_EXISTS", details: "Please wait for the current goal to expire or archive it." }
            });
        }

        const newGoal = await GroupGoal.create({
            groupId,
            title,
            subjects: [subject], // Multi-subject supports ke liye array rakha hai
            metric: metric || "questionsSolved",
            targetValue,
            deadline: new Date(deadline),
            isRecurring: isRecurring || false,
            frequency: frequency || "none"
        });

        // Update StudyGroup with this active goal ID
        group.activeGoal = newGoal._id;
        await group.save();

        res.status(201).json({
            success: true,
            message: "Goal added successfully",
            data: {
                goalId: newGoal._id,
                title: newGoal.title,
                subject: newGoal.subjects,
                metric: newGoal.metric,
                deadline: newGoal.deadline,
                progress: 0,
                isActive: true
            },
            error: null
        });
    } catch (error) {
        res.status(500).json({ success: false, error: { details: error.message } });
    }
};