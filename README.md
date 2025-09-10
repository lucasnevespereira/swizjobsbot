<div align="center">
  <img src="assets/logo.png" alt="SwizJobs Bot Logo" width="120" height="120">

  # SwizJobs Bot - Swiss Job Alert Bot

  A Telegram bot that monitors job postings in Switzerland and sends personalized alerts to users. Built for French-speaking users with family-friendly interface.

  **🚀 Try it now: [t.me/swizjobs_bot](https://t.me/swizjobs_bot)**
</div>

## Features

- 🤖 **Telegram Bot Interface** - Fully French language support
- 🔍 **Google Jobs Integration** - Comprehensive job aggregation via SerpApi
- 🎯 **Smart Filtering** - Keywords, locations, and date-based filtering
- 📱 **Real-time Notifications** - Instant job alerts via Telegram
- ⏰ **Flexible Scheduling** - Internal Node.js scheduler or external cron via HTTP endpoints
- 🗄️ **PostgreSQL Database** - Reliable data storage with Drizzle ORM
- 🧹 **Automatic Cleanup** - 90-day job posting retention policy
- 📊 **System Monitoring** - Database health and statistics endpoints
- 🐳 **Docker Ready** - Easy deployment with Docker Compose

## Job Sources

Google Jobs aggregates listings from multiple Swiss job boards including:
- **Jobup.ch** - Switzerland's leading job portal
- **Jobs.ch** - Largest Swiss job board
- **Company Career Pages** - Direct company postings
- **LinkedIn Jobs** - Professional network listings
- **Indeed Switzerland** - Job aggregator
- **Regional Job Boards** - Cantonal and specialized sites

This approach provides broader coverage than individual scrapers while being cost-effective.

## User Commands

| Command | Description |
|---------|-------------|
| `/start` | Welcome message and activation |
| `/register` | Create user account |
| `/config` | Configure job search criteria |
| `/status` | View current alert status |
| `/pause` | Temporarily disable alerts |
| `/help` | Show help information |

## Quick Start

### 1. Prerequisites

- Node.js 20+ or Docker
- PostgreSQL database
- Telegram Bot Token ([create via @BotFather](https://t.me/botfather))
- SerpApi Key ([get here](https://serpapi.com/))

### 2. Environment Setup

```bash
cp .env.example .env
# Edit .env with your API keys and database URL
```

Required environment variables:
```env
TELEGRAM_BOT_TOKEN=your_bot_token
DATABASE_URL=postgresql://user:password@localhost:5432/swiss_job_bot
SERPAPI_API_KEY=your_serpapi_key
SCHEDULER_ENABLED=true      # Enable internal scheduler (true/false)
SCHEDULER_CRON=0 */2 * * *  # Cron pattern for job processing (every 2 hours)
```

### 3. Development Setup

```bash
# Install dependencies
npm install

# Generate database migrations
npm run db:generate

# Run migrations
npm run db:migrate

# Start in development mode
npm run dev
```

### 4. Docker Deployment

```bash
# Copy environment file
cp .env.example .env
# Edit .env with your credentials

# Start with Docker Compose
docker-compose up -d

# View logs
docker-compose logs -f swizjobsbot
```

## Architecture

```
📦 swizjobsbot/
├── 🤖 src/bot/          # Telegram bot handlers
├── 🔧 src/admin/        # Admin server & API endpoints
├── ⚙️  src/config/      # Environment configuration
├── 🗃️ src/database/     # Schema & migrations
├── 🔧 src/services/     # Job scraping & alerts
├── 📝 src/types/        # TypeScript definitions
├── 🛠️ src/utils/        # Helper functions
└── 📄 src/index.ts      # Application entry point
```

### Core Services

1. **TelegramBot** - Handles user interactions and commands
2. **JobScraperService** - Scrapes jobs from Google Jobs (includes Jobup, Jobs.ch, and other Swiss job boards)
3. **JobService** - Central service for job processing, user alerts, and database cleanup
4. **SchedulerService** - Internal Node.js scheduler (optional - can use external cron instead)
5. **JobHandlers** - HTTP endpoints for job processing and cleanup
6. **AdminHandlers** - Administrative endpoints for monitoring and testing

## Database Schema

```sql
users (id, telegram_chat_id, language, active, created_at)
job_searches (id, user_id, keywords[], locations[], max_age_days, active)
job_postings (id, external_id, title, company, location, url, posted_date, source)
user_notifications (id, user_id, job_posting_id, sent_at)
```

## Production Deployment

### Railway

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login and deploy
railway login
railway init
railway up
```

### DigitalOcean Apps

1. Connect GitHub repository
2. Set environment variables
3. Configure auto-deploy from main branch

### Manual VPS

```bash
# Clone repository
git clone <your-repo>
cd swizjobsbot

# Set up environment
cp .env.example .env
# Edit .env file

# Install dependencies and build
npm ci
npm run build

# Start with PM2
npm install -g pm2
pm2 start dist/index.js --name swizjobsbot
pm2 save
pm2 startup
```

## HTTP Endpoints

### Health & Monitoring
- `GET /health` - Basic health check
- `GET /jobs/status` - Comprehensive system status with database statistics

### Job Processing
- `GET /jobs/process` - Process job alerts for all users
- `POST /jobs/cleanup` - Clean up job postings older than 90 days
- `POST /admin/test` - Test job scraping with specific criteria
- `POST /admin/trigger` - Trigger alerts for a specific user
- `GET /admin/scheduler` - Check internal scheduler status

## Scheduling Options

Choose between **internal scheduler** or **external cron** for job processing:

### Option 1: Internal Scheduler (Recommended)

Enable the internal scheduler with these environment variables:

```env
SCHEDULER_ENABLED=true      # Enable internal scheduler
SCHEDULER_CRON=0 */2 * * *  # Every 2 hours
```

The app automatically handles:
- ⏰ Job processing every 2 hours
- 🧹 Database cleanup daily at 2 AM
- 💓 Health checks every 30 minutes

**Pros**: Simple setup, integrated logging, automatic cleanup
**Cons**: Depends on app staying running

### Option 2: External Cron (Alternative)

Disable internal scheduler and use system cron instead:

```env
SCHEDULER_ENABLED=false     # Disable internal scheduler
```

Use system cron to call HTTP endpoints. The Makefile handles setup:

```bash
# Install cron jobs automatically
make cron-install

# Check what was installed
make cron-status

# Remove cron jobs if needed
make cron-remove
```

This installs:
- **Job processing**: Every 2 hours (`GET /jobs/process`)
- **Database cleanup**: Weekly on Sundays at 3 AM (`POST /jobs/cleanup`)

**Pros**: Independent of app process, system-level reliability
**Cons**: Additional setup, external dependency

### Manual Cron Setup

```bash
# Add to crontab (crontab -e)
0 */2 * * * /usr/bin/curl -s -f http://localhost:3000/jobs/process || echo "swizjobsbot: Job processing failed" | logger
0 3 * * 0 /usr/bin/curl -s -f -X POST http://localhost:3000/jobs/cleanup || echo "swizjobsbot: Job cleanup failed" | logger
```

## Monitoring

- Health check: `GET /health`
- System status: `GET /jobs/status` (includes user count, job statistics, cleanup metrics)
- Logs: Check Docker logs or PM2 logs
- Database: Monitor PostgreSQL connections and query performance

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Make your changes and test thoroughly
4. Submit a pull request

## Support

For issues and feature requests, please create an issue in the GitHub repository.

## License

MIT License - see [LICENSE](LICENSE) file for details.
