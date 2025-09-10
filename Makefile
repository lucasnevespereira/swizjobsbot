.PHONY: dev setup db migrate build clean down help cron-install cron-remove cron-status health status deploy

help:
	@echo "🤖 SwizJobs Alert Bot - Commands"
	@echo ""
	@echo "Development:"
	@echo "  dev        - Start development server (auto-setup included)"
	@echo "  setup      - Manual setup (database, schema, and dependencies)"
	@echo "  db         - Start PostgreSQL database only"
	@echo "  migrate    - Generate migration files after schema changes"
	@echo "  build      - Build for production (with migrations)"
	@echo "  clean      - Clean build artifacts and stop services"
	@echo "  down       - Stop all services"
	@echo ""
	@echo "Production:"
	@echo "  deploy     - Full production deployment"
	@echo "  cron-install   - Install cron jobs for job processing"
	@echo "  cron-remove    - Remove cron jobs"
	@echo "  cron-status    - Show current cron jobs"
	@echo "  health     - Check application health"
	@echo "  status     - Check system status with database stats"
	@echo ""

db:
	@echo "🐘 Starting PostgreSQL database..."
	@docker-compose up -d postgres

# One-time setup for contributors
setup: db
	@echo "📦 Installing dependencies..."
	@npm install
	@echo "🔄 Setting up database schema (development)..."
	@npm run db:push
	@echo "✅ Setup complete!"

# Development server (always runs setup to ensure everything works)
dev: setup
	@echo "🚀 Starting SwizJobs Bot development server..."
	@npm run dev

# For maintainers: generate migration files after schema changes
migrate:
	@echo "🔄 Generating migration from schema changes..."
	@npm run db:generate
	@echo "🔄 Applying migration to local database..."
	@npm run db:migrate
	@echo "✅ Migration files created and applied!"
	@echo "📝 Don't forget to commit the new migration files!"

build:
	@echo "🏗️  Building for production..."
	@npm run db:migrate && npm run build

clean:
	@echo "🧹 Cleaning up..."
	@rm -rf dist node_modules
	@docker-compose down -v

lint:
	@echo "🔍 Running linter..."
	@npm run lint

lint-fix:
	@echo "🔧 Fixing linting issues..."
	@npm run lint:fix

down:
	@echo "🛑 Stopping all services..."
	@docker-compose down

# Production deployment commands
PORT ?= 3000

deploy: build
	@echo "🚀 Deploying SwizJobs Bot..."
	@pm2 start dist/index.js --name swizjobsbot
	@echo "✅ Bot started with PM2"
	@echo "   Next: make cron-install"

cron-install:
	@echo "📅 Installing cron jobs..."
	@(crontab -l 2>/dev/null | grep -v "swizjobsbot" || true; \
	 echo "# swizjobsbot - Process job alerts every 2 hours"; \
	 echo "0 */2 * * * /usr/bin/curl -s -f http://localhost:$(PORT)/jobs/process || echo 'swizjobsbot: Job processing failed' | logger"; \
	 echo ""; \
	 echo "# swizjobsbot - Weekly cleanup on Sundays at 3 AM"; \
	 echo "0 3 * * 0 /usr/bin/curl -s -f -X POST http://localhost:$(PORT)/jobs/cleanup || echo 'swizjobsbot: Job cleanup failed' | logger") | crontab -
	@echo "✅ Cron jobs installed!"
	@echo "   - Job processing: Every 2 hours"
	@echo "   - Database cleanup: Sundays at 3 AM"

cron-remove:
	@echo "🗑️  Removing cron jobs..."
	@crontab -l 2>/dev/null | grep -v "swizjobsbot\|/jobs/process\|/jobs/cleanup" | crontab - 2>/dev/null || true
	@echo "✅ Cron jobs removed"

cron-status:
	@echo "📋 Current cron jobs:"
	@crontab -l 2>/dev/null || echo "No crontab installed"

health:
	@echo "🏥 Checking health..."
	@curl -s http://localhost:$(PORT)/health | jq '.' 2>/dev/null || curl -s http://localhost:$(PORT)/health

status:
	@echo "📊 Getting system status..."
	@curl -s http://localhost:$(PORT)/jobs/status | jq '.' 2>/dev/null || curl -s http://localhost:$(PORT)/jobs/status
