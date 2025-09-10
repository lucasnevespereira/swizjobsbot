import { TelegramBot } from './bot/index.js';
import { JobScraperService } from './services/jobScraper.js';
import { JobService } from './services/jobService.js';
import { SchedulerService } from './services/scheduler.js';
import { AdminHandlers } from './admin/handlers.js';
import { AdminServer } from './admin/server.js';
import { env } from './config/env.js';
import { ENV } from './types/enum.js';

class SwissJobBot {
  private telegramBot!: TelegramBot;
  private jobScraper!: JobScraperService;
  private jobService!: JobService;
  private scheduler!: SchedulerService;
  private adminServer!: AdminServer;

  constructor() {
    this.initializeServices();
  }

  private initializeServices(): void {
    console.log('🚀 Initializing SwizJobs Bot services...');

    this.telegramBot = new TelegramBot(env.TELEGRAM_BOT_TOKEN);
    this.jobScraper = new JobScraperService(env.SERPAPI_API_KEY);
    this.jobService = new JobService(this.jobScraper, this.telegramBot);
    this.scheduler = new SchedulerService(this.jobService);

    // Initialize admin server with consolidated handlers
    const adminHandlers = new AdminHandlers(this.jobService, this.telegramBot, this.scheduler);
    this.adminServer = new AdminServer(adminHandlers);

    console.log('✅ All services initialized');
  }

  async start(): Promise<void> {
    try {
      console.log('Starting SwizJobs Bot...');

      // Start scheduler
      console.log('⏰ Starting scheduler...');
      this.scheduler.start();

      // Start admin server first (keeps process alive)
      await this.adminServer.start(env.PORT);

      // Start Telegram bot in background (non-blocking)
      if (env.NODE_ENV === ENV.production) {
        console.log('🤖 Starting Telegram bot in production mode (background)...');
        // Start bot in background - don't wait for it
        this.telegramBot.start().catch((error) => {
          console.error('❌ Failed to start Telegram bot in background:', error);
        });
      } else {
        console.log('🤖 Skipping Telegram bot startup in development mode');
      }

      console.log('');
      console.log('🇨🇭 SwizJobs Bot is now running!');
      console.log('📱 Telegram bot is listening for commands');
      console.log('⏰ Scheduler is running background tasks');
      console.log('');

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
      console.log('✅ Scheduler stopped');

      if (env.NODE_ENV === ENV.production) {
        // Stop Telegram bot
        await this.telegramBot.stop();
        console.log('✅ Telegram bot stopped');
      }

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
