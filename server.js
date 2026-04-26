require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const passport = require('passport');
const connectDB = require('./config/db');
const { connectRedis } = require('./utils/redisClient');
const groupRoutes = require('./routes/groupRoutes');
const cron = require('node-cron');
const StudyGroup = require('./models/StudyGroup');
const { archiveIfExpired } = require('./controllers/goalController');
const authRoutes = require('./routes/authRoutes');
require('./config/passport')(passport);

const app = express();

// Security & Logging Middlewares
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(passport.initialize());
if (process.env.NODE_ENV === 'development') {
    app.use(morgan('dev'));
}

// Database & Redis Connections
connectDB();
connectRedis();

app.get('/', (req, res) => {
    res.json({ message: "Backend is running" });
});

// Har raat 12:00 AM UTC par ye logic chalega
cron.schedule('0 0 * * *', async () => {
    try {
        console.log("CRON: Checking for expired or recurring goals to reset/archive...");

        // Saare wo groups dhoondo jinka goal active hai
        const groups = await StudyGroup.find({ activeGoal: { $ne: null } });

        for (const group of groups) {
            await archiveIfExpired(group);
        }

        console.log("CRON: Goals checked successfully.");
    } catch (err) {
        console.error("CRON Error:", err.message);
    }
}, {
    timezone: "UTC"
});

// All Routes
app.use('/auth', authRoutes);
app.use('/groups', groupRoutes);


const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server is started in ${process.env.NODE_ENV} mode on port ${PORT}`);
});