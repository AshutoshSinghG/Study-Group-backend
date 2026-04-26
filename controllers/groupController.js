const StudyGroup = require("../models/StudyGroup");
const User = require("../models/User");
const { sendSuccess, sendError } = require("../utils/response");

// POST /groups - create a new study group
const createGroup = async (req, res) => {
  try {
    const creatorId = req.user._id;
    const { name, members } = req.body;

    if (!name || name.trim() === "") {
      return sendError(
        res,
        "Group name is required",
        "MISSING_FIELD",
        "Please provide a group name",
        400
      );
    }

    // check if this user is already a creator of another group
    const existingGroup = await StudyGroup.findOne({ creator: creatorId }).lean();
    if (existingGroup) {
      return sendError(
        res,
        "You already have a group as creator",
        "ALREADY_CREATOR",
        "A user can only create one group at a time. You are the creator of: " +
          existingGroup.name,
        409
      );
    }

    // figure out the member list
    let memberIds = [creatorId]; // creator is always a member

    if (members && members.length > 0) {
      // look up each member email, make sure they exist
      for (let i = 0; i < members.length; i++) {
        const memberEmail = members[i];
        const memberUser = await User.findOne({ email: memberEmail }).lean();

        if (!memberUser) {
          return sendError(
            res,
            `User with email ${memberEmail} not found`,
            "USER_NOT_FOUND",
            "Make sure all members have an account before adding them",
            404
          );
        }

        // don't add the creator twice
        if (memberUser._id.toString() === creatorId.toString()) {
          continue;
        }

        // check for duplicates in the list itself
        if (!memberIds.find((id) => id.toString() === memberUser._id.toString())) {
          memberIds.push(memberUser._id);
        }
      }
    }

    const newGroup = await StudyGroup.create({
      name: name.trim(),
      creator: creatorId,
      members: memberIds,
    });

    // populate the response with actual email addresses
    const populated = await StudyGroup.findById(newGroup._id)
      .populate("creator", "email name")
      .populate("members", "email name")
      .lean();

    const memberEmails = populated.members.map((m) => m.email);

    return sendSuccess(
      res,
      "Group created successfully",
      {
        groupId: populated._id,
        name: populated.name,
        creator: populated.creator.email,
        members: memberEmails,
        activeGoal: null,
        createdAt: populated.createdAt,
      },
      201
    );
  } catch (err) {
    console.log("Error creating group:", err);
    return sendError(
      res,
      "Failed to create group",
      "CREATE_GROUP_ERROR",
      err.message,
      500
    );
  }
};

// POST /groups/:id/member - add a new member to the group
const addMember = async (req, res) => {
  try {
    const groupId = req.params.id;
    const currentUserId = req.user._id;
    const { email } = req.body;

    if (!email) {
      return sendError(
        res,
        "Member email is required",
        "MISSING_FIELD",
        null,
        400
      );
    }

    const group = await StudyGroup.findById(groupId)
      .populate("members", "email")
      .lean();

    if (!group) {
      return sendError(res, "Group not found", "GROUP_NOT_FOUND", null, 404);
    }

    // need to check if this guy is actually the creator before letting him add members
    if (group.creator.toString() !== currentUserId.toString()) {
      return sendError(
        res,
        "Only the group creator can add members",
        "NOT_AUTHORIZED",
        null,
        403
      );
    }

    // find the user we want to add
    const userToAdd = await User.findOne({ email: email }).lean();
    if (!userToAdd) {
      return sendError(
        res,
        "User not found with that email",
        "USER_NOT_FOUND",
        `No account found for ${email}`,
        404
      );
    }

    // check if already in the group
    const alreadyMember = group.members.some(
      (m) => m._id.toString() === userToAdd._id.toString()
    );
    if (alreadyMember) {
      return sendError(
        res,
        "User is already a member of this group",
        "USER_ALREADY_MEMBER",
        `The email ${email} is already part of this group.`,
        409
      );
    }

    // add them
    await StudyGroup.findByIdAndUpdate(groupId, {
      $push: { members: userToAdd._id },
    });

    // get updated group
    const updatedGroup = await StudyGroup.findById(groupId)
      .populate("members", "email")
      .lean();

    const allEmails = updatedGroup.members.map((m) => m.email);

    return sendSuccess(res, "Member added successfully", {
      groupId: updatedGroup._id,
      members: allEmails,
    });
  } catch (err) {
    console.log("Error adding member:", err);
    return sendError(
      res,
      "Failed to add member",
      "ADD_MEMBER_ERROR",
      err.message,
      500
    );
  }
};

module.exports = { createGroup, addMember };
