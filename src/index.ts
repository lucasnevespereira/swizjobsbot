import dotenv from 'dotenv';
import { TelegramBot } from './bot/index.js';
import { JobScraperService } from './services/jobScraper.js';
import { AlertEngine } from './services/alertEngine.js';
import { SchedulerService } from './services/scheduler.js';
import { startHealthServer } from './utils/health.js';

// Load environment variables
dotenv.config();

class SwissJobBot {
  private telegramBot!: TelegramBot;
  private jobScraper!: JobScraperService;
  private alertEngine!: AlertEngine;
  private scheduler!: SchedulerService;

  constructor() {
    this.validateEnvironment();
    this.initializeServices();
  }

  private validateEnvironment(): void {
    const requiredEnvVars = [
      'TELEGRAM_BOT_TOKEN',
      'DATABASE_URL',
      'APIFY_API_TOKEN',
      'SERPAPI_API_KEY'
    ];

    const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

    if (missingVars.length > 0) {
      console.error('❌ Missing required environment variables:');
      missingVars.forEach(varName => console.error(`   - ${varName}`));
      console.error('\n💡 Please check your .env file and ensure all required variables are set.');
      process.exit(1);
    }

    console.log('✅ Environment variables validated');
  }

  private initializeServices(): void {
    console.log('🚀 Initializing SwizJobs Bot services...');

    // Initialize Telegram bot
    this.telegramBot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN!);

    // Initialize job scraper
    this.jobScraper = new JobScraperService(
      process.env.APIFY_API_TOKEN!,
      process.env.SERPAPI_API_KEY!
    );

    // Initialize alert engine
    this.alertEngine = new AlertEngine(this.jobScraper, this.telegramBot);

    // Initialize scheduler
    this.scheduler = new SchedulerService(this.alertEngine);

    console.log('✅ All services initialized');
  }

  async start(): Promise<void> {
    try {
      console.log('🇨🇭 Starting SwizJobs Bot...');

      // Start health server
      startHealthServer(parseInt(process.env.PORT || '3000'));

      // Start Telegram bot
      await this.telegramBot.start();

      // Start scheduler
      this.scheduler.start();

      console.log('🎉 SwizJobs Bot is now running!');
      console.log('📱 Telegram bot is listening for commands');
      console.log('⏰ Scheduler is running background tasks');
      console.log('\n💡 Users can now:');
      console.log('   - Register with /start');
      console.log('   - Configure alerts with /config');
      console.log('   - Check status with /status');
      console.log('   - Pause alerts with /pause');

    } catch (error) {
      console.error('❌ Failed to start SwizJobs Bot:', error);
      process.exit(1);
    }
  }

  async stop(): Promise<void> {
    console.log('🛑 Shutting down SwizJobs Bot...');

    try {
      // Stop scheduler
      this.scheduler.stop();

      // Stop Telegram bot
      await this.telegramBot.stop();

      console.log('✅ SwizJobs Bot shut down successfully');
    } catch (error) {
      console.error('❌ Error during shutdown:', error);
    }
  }
}

// Create and start the application
const app = new SwissJobBot();

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🔄 Received SIGINT, shutting down gracefully...');
  await app.stop();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n🔄 Received SIGTERM, shutting down gracefully...');
  await app.stop();
  process.exit(0);
});

// Start the application
app.start().catch(error => {
  console.error('💥 Fatal error:', error);
  process.exit(1);
});
