const express = require('express');
const router = express.Router();
const { createGroup, addMember } = require('../controllers/groupController');
const { protect } = require('../middleware/auth');
const { addGroupGoal } = require('../controllers/goalController');
const { recordActivity } = require('../controllers/activityController');
const { getLeaderboard } = require('../controllers/leaderboardController');
const { getGroupProgress } = require('../controllers/progressController');

router.post('/', protect, createGroup);
router.post('/:id/member', protect, addMember);

router.post('/:id/goal', protect, addGroupGoal);
router.post('/:id/activity', protect, recordActivity);

router.get('/:id/leaderboard', protect, getLeaderboard);
router.get('/:id/progress', protect, getGroupProgress);

module.exports = router;