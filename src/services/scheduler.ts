import * as cron from 'node-cron';
import { AlertEngine } from './alertEngine.js';
import { env } from '../config/env.js';

export class SchedulerService {
  private alertEngine: AlertEngine;
  private tasks: Map<string, cron.ScheduledTask> = new Map();

  constructor(alertEngine: AlertEngine) {
    this.alertEngine = alertEngine;
  }

  start(): void {
    console.log('⏰ Starting scheduler service...');
    console.log(`📅 [Scheduler] Using cron pattern: ${env.SCHEDULER_CRON}`);

    // Main job alert processing
    const alertTask = cron.schedule(env.SCHEDULER_CRON, async () => {
      const scheduledTime = new Date();
      console.log(`⏰ [${scheduledTime.toISOString()}] SCHEDULED JOB PROCESSING STARTED`);
      try {
        await this.alertEngine.processAllAlerts();
        console.log(`✅ [${new Date().toISOString()}] SCHEDULED JOB PROCESSING COMPLETED SUCCESSFULLY`);
      } catch (error) {
        console.error(`❌ [${new Date().toISOString()}] SCHEDULED JOB PROCESSING FAILED:`, error);
      }
    }, {
      scheduled: false,
      timezone: 'Europe/Zurich'
    });

    // Health check task - every 30 minutes
    const healthTask = cron.schedule('*/30 * * * *', () => {
      console.log('💓 Health check - System is running');
      console.log(`📊 Active tasks: ${this.tasks.size}`);
    }, {
      scheduled: false,
      timezone: 'Europe/Zurich'
    });

    // Database cleanup task - daily at 2 AM
    const cleanupTask = cron.schedule('0 2 * * *', async () => {
      console.log('🧹 Running daily cleanup...');
      await this.performCleanup();
    }, {
      scheduled: false,
      timezone: 'Europe/Zurich'
    });

    this.tasks.set('alerts', alertTask);
    this.tasks.set('health', healthTask);
    this.tasks.set('cleanup', cleanupTask);

    // Start all tasks
    alertTask.start();
    healthTask.start();
    cleanupTask.start();

    console.log('✅ Scheduler service started with 3 tasks:');
    console.log(`   - Job alerts: ${env.SCHEDULER_CRON}`);
    console.log('   - Health check: Every 30 minutes');
    console.log('   - Cleanup: Daily at 2 AM (CET)');
  }

  stop(): void {
    console.log('🛑 Stopping scheduler service...');

    this.tasks.forEach((task, name) => {
      task.stop();
      console.log(`   - Stopped ${name} task`);
    });

    this.tasks.clear();
    console.log('✅ Scheduler service stopped');
  }

  // Method to trigger alert processing manually
  async triggerAlerts(): Promise<void> {
    console.log('🔄 Manually triggering alert processing...');
    try {
      await this.alertEngine.processAllAlerts();
    } catch (error) {
      console.error('❌ Manual alert processing failed:', error);
      throw error;
    }
  }

  private async performCleanup(): Promise<void> {
    try {
      // This would clean up old job postings and notifications
      // For now, just log that cleanup would run
      console.log('🧹 Cleanup tasks would run here:');
      console.log('   - Remove job postings older than 30 days');
      console.log('   - Remove notifications older than 90 days');
      console.log('   - Compact database logs');
    } catch (error) {
      console.error('❌ Cleanup failed:', error);
    }
  }

  getTaskStatus(): Record<string, boolean> {
    const status: Record<string, boolean> = {};
    this.tasks.forEach((task, name) => {
      // Just return true if task exists and is scheduled
      status[name] = true;
    });
    return status;
  }
}
