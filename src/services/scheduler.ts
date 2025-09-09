import { Cron } from 'croner';
import { AlertEngine } from './alertEngine.js';
import { env } from '../config/env.js';

export class SchedulerService {
  private alertEngine: AlertEngine;
  private tasks: Map<string, Cron> = new Map();

  constructor(alertEngine: AlertEngine) {
    this.alertEngine = alertEngine;
  }

  start(): void {
    console.log('⏰ Starting scheduler service...');
    console.log(`📅 [Scheduler] Using cron pattern: ${env.SCHEDULER_CRON}`);

    // Validate and show next run time
    try {
      const nextRun = new Cron(env.SCHEDULER_CRON, { timezone: 'Europe/Zurich' });
      const nextRunTime = nextRun.nextRun();
      if (nextRunTime) {
        console.log(`🕒 [Scheduler] Next job alert run scheduled for: ${nextRunTime.toLocaleString('fr-CH', { timeZone: 'Europe/Zurich' })}`);
        console.log(`⏰ [Scheduler] Current time (CET): ${new Date().toLocaleString('fr-CH', { timeZone: 'Europe/Zurich' })}`);
      }
      nextRun.stop(); // Stop the test cron
    } catch (error) {
      console.error(`❌ [Scheduler] Invalid cron pattern: ${env.SCHEDULER_CRON}`, error);
    }

    // Main job alert processing using Cron (more reliable)
    console.log('🔧 [Scheduler] Creating main alert task with Cron...');
    const alertTask = new Cron(env.SCHEDULER_CRON, {
      timezone: 'Europe/Zurich',
      paused: false
    }, async () => {
      const scheduledTime = new Date();
      console.log(`⏰ [${scheduledTime.toISOString()}] SCHEDULED JOB PROCESSING STARTED`);
      console.log(`🕒 [Scheduler] Local time: ${scheduledTime.toLocaleString('fr-CH', { timeZone: 'Europe/Zurich' })}`);

      try {
        await this.alertEngine.processAllAlerts();
        console.log(`✅ [${new Date().toISOString()}] SCHEDULED JOB PROCESSING COMPLETED SUCCESSFULLY`);

        // Show next run time after completion
        const nextRunTime = alertTask.nextRun();
        if (nextRunTime) {
          console.log(`🕒 [Scheduler] Next job alert run: ${nextRunTime.toLocaleString('fr-CH', { timeZone: 'Europe/Zurich' })}`);
        }
      } catch (error) {
        console.error(`❌ [${new Date().toISOString()}] SCHEDULED JOB PROCESSING FAILED:`, error);
      }
    });

    console.log('✅ [Scheduler] Alert task created successfully');

    // Health check task - every 30 minutes using Cron
    const healthTask = new Cron('*/30 * * * *', {
      timezone: 'Europe/Zurich',
      paused: false
    }, () => {
      console.log('💓 Health check - System is running');
      console.log(`📊 Active tasks: ${this.tasks.size}`);
    });

    // Database cleanup task - daily at 2 AM using Cron
    const cleanupTask = new Cron('0 2 * * *', {
      timezone: 'Europe/Zurich',
      paused: false
    }, async () => {
      console.log('🧹 Running daily cleanup...');
      await this.performCleanup();
    });

    this.tasks.set('alerts', alertTask);
    this.tasks.set('health', healthTask);
    this.tasks.set('cleanup', cleanupTask);

    // Tasks are already started (paused: false), just log status
    console.log('🚀 [Scheduler] All tasks are running automatically with Cron');
    console.log(`✅ [Scheduler] Alert task running: ${alertTask.isRunning()}`);
    console.log(`✅ [Scheduler] Health task running: ${healthTask.isRunning()}`);
    console.log(`✅ [Scheduler] Cleanup task running: ${cleanupTask.isRunning()}`);

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
      status[name] = task.isRunning();
    });
    return status;
  }

  getNextRunTime(): { nextRun: string | null, currentTime: string, cronPattern: string } {
    try {
      const cronJob = new Cron(env.SCHEDULER_CRON, { timezone: 'Europe/Zurich' });
      const nextRunTime = cronJob.nextRun();
      cronJob.stop();

      return {
        nextRun: nextRunTime ? nextRunTime.toLocaleString('fr-CH', { timeZone: 'Europe/Zurich' }) : null,
        currentTime: new Date().toLocaleString('fr-CH', { timeZone: 'Europe/Zurich' }),
        cronPattern: env.SCHEDULER_CRON
      };
    } catch (error) {
      return {
        nextRun: null,
        currentTime: new Date().toLocaleString('fr-CH', { timeZone: 'Europe/Zurich' }),
        cronPattern: env.SCHEDULER_CRON + ' (INVALID)'
      };
    }
  }
}
