# SwizJobs Bot - Swiss Job Alert Bot

A Telegram bot that monitors job postings in Switzerland and sends personalized alerts to users. Built for French-speaking users with family-friendly interface.

## Features

- 🤖 **Telegram Bot Interface** - Fully French language support
- 🔍 **Multi-source Job Scraping** - jobup.ch (via Apify) + Google Jobs (via SerpApi)
- 🎯 **Smart Filtering** - Keywords, locations, and date-based filtering
- 📱 **Real-time Notifications** - Instant job alerts via Telegram
- ⏰ **Automated Scheduling** - Background processing every 2 hours
- 🗄️ **PostgreSQL Database** - Reliable data storage with Drizzle ORM
- 🐳 **Docker Ready** - Easy deployment with Docker Compose

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
- Apify API Token ([get here](https://apify.com/))
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
APIFY_API_TOKEN=your_apify_token
SERPAPI_API_KEY=your_serpapi_key
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
docker-compose logs -f swizjobs-bot
```

## Architecture

```
📦 swizjobs-bot/
├── 🤖 src/bot/          # Telegram bot handlers
├── 🔧 src/services/     # Job scraping & alerts
├── 🗃️ src/database/     # Schema & migrations
├── 📝 src/types/        # TypeScript definitions
├── 🛠️ src/utils/        # Helper functions
└── 🐳 docker/          # Deployment configs
```

### Core Services

1. **TelegramBot** - Handles user interactions and commands
2. **JobScraperService** - Scrapes jobs from multiple sources
3. **AlertEngine** - Matches jobs to user criteria and sends notifications
4. **SchedulerService** - Manages automated background tasks

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
cd swizjobs-bot

# Set up environment
cp .env.example .env
# Edit .env file

# Install dependencies and build
npm ci
npm run build

# Start with PM2
npm install -g pm2
pm2 start dist/index.js --name swizjobs_bot
pm2 save
pm2 startup
```

## Monitoring

- Health check endpoint: `http://localhost:3000/health`
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
