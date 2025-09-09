.PHONY: dev setup db migrate build clean down help

help:
	@echo "🤖 SwizJobs Alert Bot - Development Commands"
	@echo ""
	@echo "  dev        - Start development server (auto-setup included)"
	@echo "  migrate    - Generate migration files after schema changes"
	@echo "  setup      - Manual setup (database, schema, and dependencies)"
	@echo "  db         - Start PostgreSQL database only"
	@echo "  build      - Build for production (with migrations)"
	@echo "  clean      - Clean build artifacts and stop services"
	@echo "  down       - Stop all services"
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
