import { TelegramBot } from './bot/index.js';
import { JobScraperService } from './services/jobScraper.js';
import { JobService } from './services/jobService.js';
import { SchedulerService } from './services/scheduler.js';
import { AdminHandlers } from './admin/handlers.js';
import { AdminServer } from './admin/server.js';
import { env } from './config/env.js';
import crypto from 'node:crypto';

// Derive a secret webhook path from the bot token to prevent abuse
const WEBHOOK_PATH = `/webhook/${crypto.createHash('sha256').update(env.TELEGRAM_BOT_TOKEN).digest('hex').slice(0, 16)}`;

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

    const adminHandlers = new AdminHandlers(this.jobService, this.telegramBot, this.scheduler);
    this.adminServer = new AdminServer(adminHandlers);

    console.log('✅ All services initialized');
  }

  async start(): Promise<void> {
    try {
      console.log('Starting SwizJobs Bot...');

      if (!env.WEBHOOK_DOMAIN) {
        throw new Error('WEBHOOK_DOMAIN environment variable is required. Set it to your Railway public URL (e.g. https://your-app.up.railway.app)');
      }

      // Register webhook with Telegram and mount handler on Express
      console.log('🤖 Setting up Telegram bot webhook...');
      const webhookHandler = await this.telegramBot.createWebhook(env.WEBHOOK_DOMAIN, WEBHOOK_PATH);
      this.adminServer.use(webhookHandler);

      // Start admin server (keeps process alive + serves webhook)
      await this.adminServer.start(env.PORT);

      // Start scheduler
      this.scheduler.start();

      console.log('');
      console.log('🇨🇭 SwizJobs Bot is now running!');
      console.log('📱 Telegram bot is receiving updates via webhook');
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
      this.scheduler.stop();
      console.log('✅ Scheduler stopped');
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
