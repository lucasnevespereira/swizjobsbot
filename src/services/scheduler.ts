import * as cron from 'node-cron';
import { CronExpressionParser } from 'cron-parser';
import { JobService } from './jobService.js';
import { env } from '../config/env.js';
import { ENV, TIMEZONE, LOCALE, CRON_SCHEDULE } from '../types/enum.js';

export class SchedulerService {
  private jobService: JobService;
  private tasks: Map<string, cron.ScheduledTask> = new Map();

  constructor(jobService: JobService) {
    this.jobService = jobService;
  }

  start(): void {
    console.log('⏰ Starting scheduler service...');
    console.log(`📅 [Scheduler] Scheduler enabled: ${env.SCHEDULER_ENABLED}`);

    if (!env.SCHEDULER_ENABLED) {
      console.log('📴 [Scheduler] Internal scheduling disabled');
      console.log('💡 [Scheduler] Use external cron to call HTTP endpoints, or set SCHEDULER_ENABLED=true');
      console.log('📍 [Scheduler] Available endpoints: GET /jobs/process, POST /jobs/cleanup');
    }

    // Validate cron expression
    if (!cron.validate(env.SCHEDULER_CRON)) {
      console.error(`❌ [Scheduler] Invalid cron pattern: "${env.SCHEDULER_CRON}"`);
      console.log('💡 [Scheduler] Use valid 5-field cron expression (e.g., "0 */2 * * *" for every 2 hours)');
      return;
    }

    console.log(`📅 [Scheduler] Cron pattern: ${env.SCHEDULER_CRON}`);

    // Main job alert processing using configurable cron
    const alertTask = cron.schedule(env.SCHEDULER_CRON, async () => {
      const scheduledTime = new Date();
      console.log(`📅 [${scheduledTime.toISOString()}] SCHEDULED JOB PROCESSING STARTED`);
      console.log(`🕒 [Scheduler] Local time: ${scheduledTime.toLocaleString(LOCALE.frCH, { timeZone: TIMEZONE.Zurich })}`);

      // Disabled in development to avoid spamming
      if (env.NODE_ENV !== ENV.development) {
        try {
          const result = await this.jobService.processAllJobs();
          if (result.success) {
            console.log(`✅ [${result.endTime.toISOString()}] SCHEDULED JOB PROCESSING COMPLETED SUCCESSFULLY`);
          } else {
            console.error(`❌ [${result.endTime.toISOString()}] SCHEDULED JOB PROCESSING FAILED:`, result.error);
          }
        } catch (error) {
          console.error(`❌ [${new Date().toISOString()}] SCHEDULED JOB PROCESSING FAILED:`, error);
        }
      } else {
        console.log('💤 [Scheduler] Job processing skipped in development mode');
      }
    }, {
      scheduled: env.SCHEDULER_ENABLED,
      timezone: TIMEZONE.Zurich
    });

    // Health check task - every 30 minutes
    const healthTask = cron.schedule(CRON_SCHEDULE.every30Minutes, () => {
      console.log('💓 Health check - System is running');
      console.log(`📊 Active tasks: ${this.tasks.size}`);
    }, {
      scheduled: env.SCHEDULER_ENABLED,
      timezone: TIMEZONE.Zurich
    });

    // Database cleanup task - daily at 2 AM
    const cleanupTask = cron.schedule(CRON_SCHEDULE.dailyAt2AM, async () => {
      console.log('🧹 Running daily cleanup...');
      try {
        const result = await this.jobService.cleanupJobs(90);
        if (result.success) {
          console.log(`✅ [${result.endTime.toISOString()}] SCHEDULED CLEANUP COMPLETED SUCCESSFULLY`);
        } else {
          console.error(`❌ [${result.endTime.toISOString()}] SCHEDULED CLEANUP FAILED:`, result.error);
        }
      } catch (error) {
        console.error(`❌ [${new Date().toISOString()}] SCHEDULED CLEANUP FAILED:`, error);
      }
    }, {
      scheduled: env.SCHEDULER_ENABLED,
      timezone: TIMEZONE.Zurich
    });

    this.tasks.set('alerts', alertTask);
    this.tasks.set('health', healthTask);
    this.tasks.set('cleanup', cleanupTask);

    const status = env.SCHEDULER_ENABLED ? 'enabled' : 'disabled';
    console.log(`✅ Scheduler service started (${status}) with 3 tasks:`);
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
      const result = await this.jobService.processAllJobs();
      if (!result.success && result.error) {
        throw new Error(result.error);
      }
    } catch (error) {
      console.error('❌ Manual alert processing failed:', error);
      throw error;
    }
  }

  getTaskStatus(): Record<string, boolean> {
    const status: Record<string, boolean> = {};
    this.tasks.forEach((task, name) => {
      // node-cron tasks don't expose running state, assume true if scheduled
      status[name] = true;
    });
    return status;
  }

  getNextRunTime(): { nextRun: string | null, currentTime: string, cronPattern: string, enabled: boolean } {
    const now = new Date();
    const currentTime = now.toLocaleString(LOCALE.frCH, { timeZone: TIMEZONE.Zurich });

    if (!env.SCHEDULER_ENABLED) {
      return {
        nextRun: null,
        currentTime,
        cronPattern: env.SCHEDULER_CRON,
        enabled: false
      };
    }

    try {
      // Parse the cron expression and get next execution time
      const interval = CronExpressionParser.parse(env.SCHEDULER_CRON, {
        currentDate: now,
        tz: TIMEZONE.Zurich
      });

      const nextRun = interval.next().toDate();

      return {
        nextRun: nextRun.toLocaleString(LOCALE.frCH, { timeZone: TIMEZONE.Zurich }),
        currentTime,
        cronPattern: env.SCHEDULER_CRON,
        enabled: true
      };
    } catch (error) {
      console.error('Failed to parse cron expression:', error);
      return {
        nextRun: null,
        currentTime,
        cronPattern: env.SCHEDULER_CRON + ' (INVALID)',
        enabled: false
      };
    }
  }
}
