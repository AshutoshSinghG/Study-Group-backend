const StudyGroup = require('../models/StudyGroup');
const User = require('../models/User');

//Create Group
exports.createGroup = async (req, res) => {
    try {
        const { name, members } = req.body;
        const creatorEmail = req.user.email;

        //A single user can be a creator in only one group at a time 
        const existingGroup = await StudyGroup.findOne({ creator: creatorEmail });
        if (existingGroup) {
            return res.status(400).json({
                success: false,
                message: "You are already a creator of another group",
                data: null,
                error: { code: "CREATOR_LIMIT_REACHED", details: "One user can create only one group." }
            });
        }

        // Creator ko members list mein add karna (agar pehle se nahi hai)
        let groupMembers = members || [];
        if (!groupMembers.includes(creatorEmail)) {
            groupMembers.push(creatorEmail);
        }

        const newGroup = await StudyGroup.create({
            name,
            creator: creatorEmail,
            members: groupMembers
        });

        res.status(201).json({
            success: true,
            message: "Group created successfully",
            data: {
                groupId: newGroup._id,
                name: newGroup.name,
                creator: newGroup.creator,
                members: newGroup.members,
                activeGoal: null,
                createdAt: newGroup.createdAt
            },
            error: null
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Server Error",
            data: null,
            error: { code: "SERVER_ERROR", details: error.message }
        });
    }
};

//Add a member to group
exports.addMember = async (req, res) => {
    try {
        const { email } = req.body;
        const groupId = req.params.id;

        const group = await StudyGroup.findById(groupId);
        if (!group) {
            return res.status(404).json({ success: false, message: "Group not found" });
        }

        //Only creator can add members 
        if (group.creator !== req.user.email) {
            return res.status(403).json({
                success: false,
                message: "Only the group creator can add members",
                error: { code: "UNAUTHORIZED_ACTION" }
            });
        }

        //Cannot add duplicate members
        if (group.members.includes(email)) {
            return res.status(409).json({
                success: false,
                message: "User is already a member of this group",
                data: null,
                error: { 
                    code: "USER_ALREADY_MEMBER", 
                    details: `The email ${email} is already part of this group.` 
                }
            });
        }

        //add member
        group.members.push(email);
        await group.save();

        res.status(200).json({
            success: true,
            message: "Member added successfully",
            data: {
                groupId: group._id,
                members: group.members
            },
            error: null
        });
    } catch (error) {
        res.status(500).json({ success: false, error: { details: error.message } });
    }
};