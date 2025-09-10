import express from 'express';
import { TelegramBot } from './bot/index.js';
import { JobScraperService } from './services/jobScraper.js';
import { JobService } from './services/jobService.js';
import { SchedulerService } from './services/scheduler.js';
import { JobHandlers } from './handlers/jobs.js';
import { AdminHandlers } from './handlers/admin.js';
import { env } from './config/env.js';
import { ENV } from './types/enum.js';

class SwissJobBot {
  private app: express.Application;
  private telegramBot!: TelegramBot;
  private jobScraper!: JobScraperService;
  private jobService!: JobService;
  private scheduler!: SchedulerService;
  private jobHandlers!: JobHandlers;
  private adminHandlers!: AdminHandlers;

  constructor() {
    this.app = express();
    this.initializeServices();
    this.setupMiddleware();
    this.setupRoutes();
  }

  private initializeServices(): void {
    console.log('🚀 Initializing SwizJobs Bot services...');

    this.telegramBot = new TelegramBot(env.TELEGRAM_BOT_TOKEN);
    this.jobScraper = new JobScraperService(env.SERPAPI_API_KEY);
    this.jobService = new JobService(this.jobScraper, this.telegramBot);
    this.scheduler = new SchedulerService(this.jobService);

    this.jobHandlers = new JobHandlers(this.jobService);
    this.adminHandlers = new AdminHandlers(this.jobService, this.telegramBot, this.scheduler);

    console.log('✅ All services initialized');
  }

  private setupMiddleware(): void {
    this.app.use(express.json());
  }

  private setupRoutes(): void {
    // Health check
    this.app.get('/health', this.adminHandlers.healthCheck);

    // Admin routes
    this.app.post('/admin/test', this.adminHandlers.testScraper);
    this.app.post('/admin/trigger', this.adminHandlers.triggerUserAlerts);
    this.app.get('/admin/scheduler', this.adminHandlers.schedulerStatus);

    // Job routes
    this.app.get('/jobs/process', this.jobHandlers.processAllJobs);
    this.app.get('/jobs/status', this.jobHandlers.getJobStatus);
    this.app.post('/jobs/cleanup', this.jobHandlers.cleanupJobs);
  }

  async start(): Promise<void> {
    try {
      console.log('🇨🇭 Starting SwizJobs Bot...');

      if (env.NODE_ENV === ENV.production) {
        console.log('🤖 Starting Telegram bot in production mode...');
        await this.telegramBot.start();
        console.log('✅ Telegram bot started successfully');
      }

      // Start scheduler
      console.log('⏰ Starting scheduler...');
      this.scheduler.start();
      console.log('✅ Scheduler started successfully');

      // Start HTTP server (keeps process alive)
      this.app.listen(env.PORT, () => {
        console.log(`🔧 HTTP server listening on port ${env.PORT}`);
        console.log(`📋 Available endpoints:`);
        console.log(`   - GET /health (Health check)`);
        console.log(`   - POST /admin/test (Test job scraping)`);
        console.log(`   - POST /admin/trigger (Trigger user alerts)`);
        console.log(`   - GET /admin/scheduler (Scheduler status)`);
        console.log(`   - GET /jobs/process (Job processing)`);
        console.log(`   - GET /jobs/status (Job status)`);
        console.log(`   - POST /jobs/cleanup (Job cleanup)`);
        console.log('');
        console.log('');
        console.log('🎉 SwizJobs Bot is now running!');
        console.log('📱 Telegram bot is listening for commands');
        console.log('⏰ Scheduler is running background tasks');
        console.log('\n💡 Users can now:');
        console.log('   - Register with /start');
        console.log('   - Configure alerts with /config');
        console.log('   - Check status with /status');
        console.log('   - Pause alerts with /pause');
        console.log('');
      });

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
