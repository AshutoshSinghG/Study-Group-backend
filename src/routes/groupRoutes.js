const express = require("express");
const router = express.Router();
const groupController = require("../controllers/groupController");
const { requireAuth } = require("../middleware/auth");

router.use(requireAuth);

router.post("/", groupController.createGroup);
router.post("/:id/member", groupController.addMember);
router.post("/:id/goal", groupController.addGoal);
router.post("/:id/activity", groupController.recordActivity);
router.get("/:id/leaderboard", groupController.getLeaderboard);
router.get("/:id/progress", groupController.getProgress);

module.exports = router;
