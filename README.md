# Study Group Backend

Backend for an ed-tech application supporting **Custom Study Groups with Live Leaderboards**. Built with Node.js, Express, MongoDB, and Redis.

## Tech Stack

- **Runtime:** Node.js
- **Framework:** Express.js
- **Database:** MongoDB (Mongoose ODM)
- **Caching:** Redis (ioredis)
- **Auth:** Google OAuth 2.0 + JWT

## Getting Started

### Prerequisites

- Node.js >= 18.x
- MongoDB (local or Atlas)
- Redis (local or cloud like Redis Cloud / AWS ElastiCache)
- Google Cloud Console project with OAuth 2.0 credentials

### Installation

```bash
# clone the repo
git clone <your-repo-url>
cd study-group-backend

# install dependencies
npm install

# copy env template and fill in your values
cp .env.example .env
```

### Environment Variables

| Variable | Description |
|----------|-------------|
| `PORT` | Server port (default: 5000) |
| `MONGO_URI` | MongoDB connection string |
| `REDIS_URL` | Redis connection URL |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret |
| `GOOGLE_CALLBACK_URL` | OAuth callback URL |
| `JWT_SECRET` | Secret key for signing JWTs |

### Running Locally

```bash
# development with auto-reload
npm run dev

# production
npm start
```

## API Endpoints

All endpoints (except auth) require a JWT token in the `Authorization: Bearer <token>` header.

### Authentication

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/auth/google` | Start Google OAuth flow |
| GET | `/auth/google/callback` | OAuth callback (returns JWT) |
| GET | `/auth/me` | Get current user info |

### Study Groups

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/groups` | Create a study group |
| POST | `/groups/:id/member` | Add a member to a group |

### Group Goals

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/groups/:id/goal` | Create a new group goal |
| PUT | `/groups/:id/goal` | Edit the active goal |

### Activity

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/groups/:id/activity` | Record a solved question |

### Leaderboard & Progress

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/groups/:id/leaderboard` | Get leaderboard with filters |
| GET | `/groups/:id/progress` | Get group goal progress |

### Leaderboard Query Parameters

| Param | Values | Default |
|-------|--------|---------|
| `metric` | `solved`, `percentage`, `timeSpent` | `solved` |
| `sort` | `asc`, `desc` | `desc` |
| `timeWindow` | `daily`, `weekly`, `all` | `all` |
| `subject` | Comma-separated subject names | all subjects |
| `offset` | Number | `0` |
| `limit` | Number | `10` |

### Utility Routes

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/subjects` | Create a subject |
| GET | `/subjects` | List all subjects |
| POST | `/subjects/questions` | Create a question |
| GET | `/subjects/questions` | List questions |

## Deployment (AWS EC2)

### 1. Launch an EC2 Instance

- Use Ubuntu 22.04 LTS AMI
- Instance type: t2.micro (free tier) or t3.small
- Open ports: 22 (SSH), 80 (HTTP), 443 (HTTPS), 5000

### 2. Install Dependencies on EC2

```bash
# update system
sudo apt update && sudo apt upgrade -y

# install Node.js 18+
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# install Redis
sudo apt install -y redis-server
sudo systemctl enable redis-server

# verify
node -v
redis-cli ping
```

### 3. Deploy the App

```bash
# clone your repo
git clone <your-repo-url>
cd study-group-backend

# install deps
npm install --production

# set up environment variables
cp .env.example .env
nano .env   # fill in your production values

# use PM2 for process management
sudo npm install -g pm2
pm2 start server.js --name study-group-api
pm2 save
pm2 startup
```

### 4. Set Up Nginx (Optional, for port 80)

```bash
sudo apt install -y nginx

# create config
sudo nano /etc/nginx/sites-available/studygroup

# add:
# server {
#     listen 80;
#     server_name your-domain.com;
#     location / {
#         proxy_pass http://localhost:5000;
#         proxy_http_version 1.1;
#         proxy_set_header Upgrade $http_upgrade;
#         proxy_set_header Connection 'upgrade';
#         proxy_set_header Host $host;
#         proxy_cache_bypass $http_upgrade;
#     }
# }

sudo ln -s /etc/nginx/sites-available/studygroup /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### 5. MongoDB Atlas Setup

- Create a free cluster at [mongodb.com/atlas](https://www.mongodb.com/atlas)
- Whitelist your EC2's IP address
- Copy the connection string into your `.env`

## Response Format

All API responses follow this structure:

```json
{
  "success": true,
  "message": "Description",
  "data": { },
  "error": null
}
```

Error responses:

```json
{
  "success": false,
  "message": "Error description",
  "data": null,
  "error": {
    "code": "ERROR_CODE",
    "details": "Optional details"
  }
}
```

## Project Structure

```
├── server.js              # Entry point
├── config/
│   ├── db.js              # MongoDB connection
│   ├── redis.js           # Redis client
│   └── passport.js        # Google OAuth strategy
├── middleware/
│   ├── auth.js            # JWT verification
│   └── errorHandler.js    # Global error handler
├── models/
│   ├── User.js
│   ├── Subject.js
│   ├── Question.js
│   ├── StudyGroup.js
│   ├── GroupGoal.js
│   └── GroupMemberActivity.js
├── controllers/
│   ├── authController.js
│   ├── groupController.js
│   ├── goalController.js
│   ├── activityController.js
│   ├── leaderboardController.js
│   └── progressController.js
├── routes/
│   ├── authRoutes.js
│   ├── groupRoutes.js
│   └── subjectRoutes.js
└── utils/
    ├── response.js
    └── cacheHelper.js
```
