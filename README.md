# Group Study Backend

A Node.js backend service for an ed-tech application that supports Custom Study Groups with Live Leaderboards.

## Features

- JWT-Based Mock Google OAuth
- Custom Study Groups (1 Creator, Multiple Members)
- Group Goals with Deadlines
- Real-time Progress Tracking
- Live Leaderboard with Pagination, Sorting, and Filtering
- Redis Caching for optimal performance

## Technology Stack

- **Framework**: Express.js (Node.js)
- **Database**: MongoDB (Mongoose)
- **Caching**: Redis
- **Auth**: JWT

## Prerequisites

- Node.js (v14+ recommended)
- MongoDB instance (local or Atlas)
- Redis server (local or Redis Cloud)

## Local Setup

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Configure Environment Variables**
   Ensure your `.env` file is set up correctly:
   ```env
   PORT=5000
   MONGODB_URI=mongodb://127.0.0.1:27017/group_study_db
   REDIS_URL=redis://127.0.0.1:6379
   JWT_SECRET=supersecretjwtkeyforgroupstudy
   ```

3. **Start the Server**
   ```bash
   npm run dev
   # or
   node server.js
   ```

## Deployment Instructions (AWS EC2)

1. Provision an EC2 instance (Ubuntu Server 22.04 LTS).
2. SSH into the instance:
   ```bash
   ssh -i "your-key.pem" ubuntu@your-ec2-ip
   ```
3. Update packages and install Node.js:
   ```bash
   sudo apt update
   curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
   sudo apt install -y nodejs
   ```
4. Install Redis & MongoDB (or use managed services like Redis Cloud and MongoDB Atlas for production).
   ```bash
   sudo apt install redis-server
   sudo systemctl enable redis-server.service
   ```
5. Clone your repository:
   ```bash
   git clone <your-repo-url>
   cd group-study-backend
   ```
6. Install dependencies:
   ```bash
   npm install
   ```
7. Set up `.env` for production.
8. Install PM2 for process management:
   ```bash
   sudo npm install pm2 -g
   pm2 start server.js --name "group-study-backend"
   pm2 startup
   pm2 save
   ```
9. Set up Nginx as a reverse proxy to forward traffic from port 80 to your Node.js app on port 5000.

## API Endpoints Overview

You can import the included `Postman_Collection.json` to test all endpoints.
- `POST /auth/mock-google-login`: Issue JWT token
- `POST /groups`: Create a study group
- `POST /groups/:id/member`: Add member
- `POST /groups/:id/goal`: Add goal
- `POST /groups/:id/activity`: Record activity
- `GET /groups/:id/leaderboard`: View leaderboard
- `GET /groups/:id/progress`: View group progress
