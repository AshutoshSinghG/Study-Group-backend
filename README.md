
# Custom Study Groups with Live Leaderboards

This is an intermediate level backend service that helps students create private groups, set goals, and track their progress through a real-time leaderboard. It is built using **node.js, express, mongodb, and redis**.

## Features:

* **Google OAuth (JWT-based):** Secure login system where only Google email authenticated users can create groups or contribute.
* **Study Groups Management:** Users can create groups. A user can only be the creator of one group at a time (Strict Rule).
* **Dynamic Goal Setting:** * Only One active goal at a time.
    * Goal types: **Deadline-based** (e.g., Solve by Friday) or **Recurring** (Daily/Weekly).
    * Auto-archiving logic: If deadline is passed, then goal is automatically archived.
* **Real-time Leaderboard:** * **Dense Ranking:** If two users have same score, then both will get same rank.
    * **Multiple Metrics:** Rank by Questions Solved, Time Spent, or Percentage.
    * **Pagination & Filtering:** Top 10 users along with the current logged-in user's rank is shown.
* **Performance Optimization:** Redis caching is used to make the leaderboard load in less than 500ms.
* **Automated Resets:** Cron jobs are set to check and reset old goals every night (UTC time).

---

## Tech Stack

* **Runtime:** Node.js
* **Framework:** Express.js
* **Database:** MongoDB (Mongoose ODM)
* **Caching:** Redis
* **Auth:** Passport.js (Google Strategy) & JWT
* **Task Scheduling:** Node-cron
* **Security:** Helmet, CORS, Express-validator

---

## Project Structure (Architecture)

```text
├── config/             # DB aur Passport configuration
├── controllers/        # Business logic (Auth, Group, Goal, Leaderboard)
├── models/             # Mongoose Schemas (User, Group, Goal, Activity, etc.)
├── routes/             # API Endpoints definition
├── utils/              # Helper functions (Redis client, Response formatter)
├── middleware/         # Auth guard aur Error handlers
└── server.js           # App entry point & Cron jobs
```

---

## Getting Started

### 1. Prerequisites
* Node.js installed
* MongoDB Atlas account
* Redis (Local ya Cloud)
* Google Cloud Console credentials (Client ID & Secret)

### 2. Installation
```bash
# Clone the repository
git clone https://github.com/AshutoshSinghG/Study-Group-backend

# Go to the project folder
cd Study-Group-backend

# Install Dependencies
npm install
```

### 3. Environment Setup (.env)
Create an .env file and add the following values:
```env
PORT=5000
MONGO_URI=your_mongodb_uri
REDIS_URL=your_redis_url
JWT_SECRET=your_jwt_secret
GOOGLE_CLIENT_ID=your_google_id
GOOGLE_CLIENT_SECRET=your_google_secret
```

### 4. Run the App
```bash
# Development mode
npm run dev

# Production mode
npm start
```

---

## 📡 API Endpoints (Quick Reference)

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/auth/google` | Google Login shuru karein |
| `POST` | `/groups` | Naya study group banayein |
| `POST` | `/groups/:id/goal` | Group ke liye goal set karein |
| `PUT` | `/groups/:id/goal` | Active goal edit karein (Creator only) |
| `POST` | `/groups/:id/activity` | Apni study activity record karein |
| `GET` | `/groups/:id/leaderboard` | Real-time leaderboard dekhein |
| `GET` | `/groups/:id/progress` | Overall group progress dekhein |

---

## Important Assumptions & Logic
1.  **Deduplication:** A user cannot earn points by submitting the same question multiple times for the same goal (Unique constraint on User + Goal + Question).
2.  **UTC Standard:** All time tracking and daily resets are done according to UTC timezone to maintain global consistency.
3.  **Cache Busting:** Whenever a new member records activity, the leaderboard cache for that specific group is invalidated (deleted) to keep the data fresh.

---

### Developed By
**Ashutosh Kumar**
* Full Stack Developer(Backend*)
---
