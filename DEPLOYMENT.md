# 🚀 SwizJobs Bot - Deployment Guide

Complete guide for deploying the Swiss Job Bot to production using **OVH VPS + Neon Database**.

## 📋 Prerequisites

- **OVH VPS** with SSH access
- **Neon PostgreSQL** database (free tier available)
- **Telegram Bot Token** (from @BotFather)
- **SerpAPI Key** (for Google Jobs integration)
- **Domain** (optional - for HTTPS with Caddy)

## 🏗️ Architecture Overview

```
Internet → Domain/IP → OVH VPS → SwizJobs Bot → Neon PostgreSQL
                      (Ubuntu)   (Node.js)      (Cloud Database)
```

## 🗄️ Database Setup (Neon)

### 1. Create Neon Database

1. Go to [neon.tech](https://neon.tech) and create account
2. Create new project: **"SwizJobs Bot"**
3. Select region closest to your VPS
4. Copy the connection string:
   ```
   postgresql://username:password@ep-xxx.region.aws.neon.tech/neondb?sslmode=require
   ```
5. Save this URL for environment configuration

### 2. Benefits of Neon

- ✅ **Free tier**: 512MB storage, 1 database
- ✅ **Serverless**: Auto-scaling, sleep when idle
- ✅ **Managed**: No PostgreSQL maintenance required
- ✅ **Backups**: Automatic point-in-time recovery
- ✅ **SSL**: Built-in secure connections

## 🖥️ VPS Setup (OVH)

### 1. Connect to VPS

```bash
# Connect via SSH
ssh root@your-ovh-vps-ip
# or if using ubuntu user:
ssh ubuntu@your-ovh-vps-ip
```

### 2. Install System Dependencies

```bash
# Update system packages
sudo apt update && sudo apt upgrade -y

# Install Node.js 20 (Latest LTS)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PM2 process manager
sudo npm install -g pm2

# Install Git and build tools
sudo apt install git build-essential -y

# Verify installations
node --version  # Should show v20.x.x
npm --version
pm2 --version
```

## 📁 Code Deployment

### Option A: Upload via SCP (Recommended)

```bash
# From your local machine (new terminal):
cd /Users/
scp -r swizjobsbot/ root@your-ovh-ip:/root/

# Then on VPS:
cd /root/swizjobsbot
```

### Option B: Git Clone

```bash
# On VPS (if code is on GitHub):
git clone https://github.com/lucasnevespereira/swizjobsbot.git
cd swizjobsbot
```

## ⚙️ Environment Configuration

### 1. Create Environment File

```bash
# Create .env file
nano .env
```

### 2. Add Configuration

```env
NODE_ENV=production
PORT=3000
DATABASE_URL=postgresql://username:password@ep-xxx.region.aws.neon.tech/neondb?sslmode=require
TELEGRAM_BOT_TOKEN=your_telegram_bot_token_here
SERPAPI_API_KEY=your_serpapi_key_here
SCHEDULER_ENABLED=true
SCHEDULER_CRON=0 */2 * * *
```

**Save**: `Ctrl+X` → `Y` → `Enter`

## 🏗️ Build and Initialize

### 1. Install Dependencies

```bash
# Install npm packages
npm install
```

### 2. Build Application

```bash
# Compile TypeScript to JavaScript
npm run build
```

### 3. Initialize Database

```bash
# Push database schema to Neon
npm run db:push
```

### 4. Test Run (Optional)

```bash
# Quick test (press Ctrl+C to stop)
npm start
# Should show: "🎉 SwizJobs Bot is now running!"
```

## 🚀 Production Deployment

### 1. Quick Deploy with Makefile

```bash
# One command deployment
make deploy

# Install cron jobs for automatic processing
make cron-install

# Check everything is working
make health
```

**Manual PM2 approach** (if you prefer):
```bash
# Start bot as background process
pm2 start dist/index.js --name swizjobsbot

# Check status
pm2 status
```

### 2. Configure Auto-Start

```bash
# Setup PM2 to start on boot
pm2 startup
# Copy and run the command it displays

# Save current PM2 configuration
pm2 save
```

## ⏰ Job Scheduling Setup

Choose your preferred scheduling method:

### Option 1: Internal Scheduler (Recommended) ✅

The bot includes a built-in scheduler that handles everything automatically:

- ✅ **Already configured**: Uses `SCHEDULER_ENABLED=true` and `SCHEDULER_CRON=0 */2 * * *` from your .env
- ✅ **Automatic**: Job processing every 2 hours + daily cleanup at 2 AM
- ✅ **Integrated logging**: All logs appear in PM2 logs
- ✅ **Health monitoring**: Built-in health checks every 30 minutes
- ✅ **No additional setup needed**

**Check scheduler status:**
```bash
curl http://localhost:3000/admin/scheduler
```

### Option 2: External Cron (Alternative)

If you prefer system-level cron jobs instead:

**Using Makefile:**
```bash
# Install cron jobs for automatic processing
make cron-install

# Verify cron installation
make cron-status
```

**Manual cron setup:**
```bash
crontab -e
# Add these lines:
0 */2 * * * /usr/bin/curl -s -f http://localhost:3000/jobs/process || echo "SwizJobs: Job processing failed" | logger
0 3 * * 0 /usr/bin/curl -s -f -X POST http://localhost:3000/jobs/cleanup || echo "SwizJobs: Job cleanup failed" | logger
```

**Note**: If using external cron, you can disable internal scheduler by setting `SCHEDULER_ENABLED=false` in your .env file.

## 📊 Monitor Process

```bash
# View live logs
pm2 logs swizjobsbot

# View process details
pm2 show swizjobsbot

# Monitor all processes
pm2 monit
```


## 🧪 Testing Deployment

### 1. Health Check

```bash
# Test health endpoint
curl http://localhost:3000/health

# Expected response:
# {"status":"healthy","timestamp":"...","service":"swiszjobs-bot"}
```

### 2. Admin Test Endpoint

```bash
# Test job scraping (replace YOUR_CHAT_ID)
curl -X POST http://localhost:3000/admin/test \
  -H "Content-Type: application/json" \
  -d '{
    "keywords": ["développeur", "software"],
    "locations": ["Vaud", "Geneva"],
    "chatId": "YOUR_TELEGRAM_CHAT_ID"
  }'
```

### 3. Scheduler Status

```bash
# Check internal scheduler status
curl http://localhost:3000/admin/scheduler

# Expected response shows next run time and active tasks
```

### 4. Telegram Bot Testing

1. **Open Telegram app**
2. **Search for your bot**: `@your_bot_username`
   - Or try the live bot: [t.me/swizjobs_bot](https://t.me/swizjobs_bot)
3. **Test commands**:
   - `/start` - Should show welcome message
   - `/register` - Should register new user
   - `/config` - Should start configuration flow
   - `/status` - Should show current status
   - `/help` - Should show help information

## 🌐 Domain Setup (Optional)

### 1. DNS Configuration

If you have a domain (e.g., `lucasnp.dev`):

1. **Login to your domain provider** (Hostinger, etc.)
2. **Add A Record**:
   - **Name**: `swizjobsbot` (or subdomain of choice)
   - **Type**: `A`
   - **Value**: `your-ovh-vps-ip`
   - **TTL**: `300`

### 2. Install Caddy Reverse Proxy

```bash
# Install Caddy
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update
sudo apt install caddy
```

### 3. Configure Caddy

```bash
# Create Caddyfile
sudo nano /etc/caddy/Caddyfile
```

**Add configuration**:
```caddy
swizjobsbot.yourdomain.com {
    reverse_proxy localhost:3000
}
```

### 4. Start Caddy

```bash
# Test configuration
sudo caddy validate --config /etc/caddy/Caddyfile

# Start Caddy
sudo systemctl start caddy
sudo systemctl enable caddy

# Allow HTTP/HTTPS through firewall
sudo ufw allow 80
sudo ufw allow 443
```

## 📊 Process Management

### PM2 Commands

```bash
# View all processes
pm2 list

# View logs (live)
pm2 logs swizjobsbot

# View logs (last 50 lines)
pm2 logs swizjobsbot --lines 50

# Restart process
pm2 restart swizjobsbot

# Stop process
pm2 stop swizjobsbot

# Delete process
pm2 delete swizjobsbot

# Reload with zero downtime
pm2 reload swizjobsbot

# Monitor resources
pm2 monit
```

### Log Files

```bash
# PM2 logs location
~/.pm2/logs/

# Application logs
tail -f ~/.pm2/logs/swizjobsbot-out.log
tail -f ~/.pm2/logs/swizjobsbot-error.log

# System logs
sudo journalctl -u pm2-root -f
```

## 🔄 Updates and Maintenance

### 1. Code Updates

```bash
# Stop bot
pm2 stop swizjobsbot

# Pull latest code (if using Git)
git pull origin main

# Or upload new code via SCP
scp -r swizjobsbot/ root@your-ovh-ip:/root/

# Rebuild
npm install
npm run build

# Push database changes (if any)
npm run db:push

# Restart bot
pm2 restart swizjobsbot
```

### 2. Database Maintenance

```bash
# View database status in Neon dashboard
# Neon handles backups, updates, and scaling automatically

# To reset database (careful!)
npm run db:push --force
```

### 3. System Updates

```bash
# Update system packages
sudo apt update && sudo apt upgrade -y

# Update Node.js (if needed)
# Check current: node --version
# Install new version using NodeSource repository

# Update PM2
npm update -g pm2
```

## 🚨 Troubleshooting

### Common Issues

#### Bot Not Starting
```bash
# Check PM2 status
pm2 status

# View error logs
pm2 logs swizjobsbot --err

# Check environment variables
cat .env

# Test direct start
npm start
```

#### Database Connection Issues
```bash
# Test database connection
npm run db:push

# Check Neon database status in dashboard
# Verify DATABASE_URL in .env file
```

#### Telegram Bot Not Responding
```bash
# Check bot token
curl "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getMe"

# View bot logs
pm2 logs swizjobsbot | grep -i telegram

# Test webhook (if using)
curl "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getWebhookInfo"
```

#### Port Already in Use
```bash
# Find process using port 3000
sudo lsof -i :3000

# Kill process if needed
sudo kill -9 <PID>
```

### Log Analysis

```bash
# Search for errors in logs
pm2 logs swizjobsbot | grep -i error

# Search for specific patterns
pm2 logs swizjobsbot | grep -i "database\|telegram\|scraper"

# Monitor in real-time
pm2 logs swizjobsbot --raw | grep -i error
```

## ✅ Success Checklist

Your deployment is successful when:

- [ ] **PM2 Status**: Shows `online` and low restart count
- [ ] **Health Check**: `curl http://localhost:3000/health` returns JSON
- [ ] **Database**: `npm run db:push` completes successfully
- [ ] **Telegram Bot**: Responds to `/start` command
- [ ] **Admin Test**: Scraper finds jobs and sends notifications
- [ ] **Scheduler**: `curl http://localhost:3000/admin/scheduler` shows next run time
- [ ] **Logs**: Show scheduled processing (internal scheduler or cron jobs)
- [ ] **Auto-Start**: Bot restarts after server reboot
- [ ] **Domain** (if configured): HTTPS access works

## 📞 Support

For issues:

1. **Check logs**: `pm2 logs swizjobsbot`
2. **Review this guide**: Ensure all steps completed
3. **Test individually**: Health check, database, Telegram
4. **Check Neon dashboard**: Database status and connections
5. **Verify environment**: All required variables set correctly

## 🎉 Congratulations!

Your Swiss Job Bot is now running 24/7, automatically:

- 🔍 **Scraping jobs** from Google Jobs (including Jobup, Jobs.ch, etc.)
- 📱 **Sending alerts** to registered Telegram users
- 💾 **Storing data** securely in Neon PostgreSQL
- 🕒 **Processing** job searches every 2 hours
- 🛡️ **Running securely** with proper firewall configuration

Your users can now register with `/start` and configure job alerts with `/config`!
