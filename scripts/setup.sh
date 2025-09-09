#!/bin/bash

set -e

echo "🇨🇭 SwizJobs Alert Bot - Setup Script"
echo "======================================"

# Check if .env exists
if [ ! -f .env ]; then
    echo "📝 Creating environment file..."
    cp .env.example .env
    echo "✅ .env file created from template"
    echo ""
    echo "⚠️  Please edit .env and add your API tokens:"
    echo "   - TELEGRAM_BOT_TOKEN (from @BotFather)"
    echo "   - APIFY_API_TOKEN (from apify.com)"
    echo "   - SERPAPI_API_KEY (from serpapi.com)"
    echo "   - DATABASE_URL (your PostgreSQL connection string)"
    echo ""
    read -p "Press Enter when you've configured .env..."
else
    echo "✅ Environment file already exists"
fi

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Generate database schema
echo "🗄️  Generating database schema..."
npm run db:generate

echo ""
echo "🎉 Setup complete!"
echo ""
echo "Next steps:"
echo "1. Start PostgreSQL database (or use Docker Compose)"
echo "2. Run database migrations: npm run db:migrate"
echo "3. Start the bot: npm run dev"
echo ""
echo "For Docker deployment: docker-compose up -d"
