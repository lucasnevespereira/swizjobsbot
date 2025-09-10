import { Request, Response } from 'express';
import { JobService } from '../services/jobService.js';
import { db } from '../database/connection.js';
import { jobPostings, userNotifications, jobSearches, users } from '../database/schema.js';
import { count, sql } from 'drizzle-orm';

export class JobHandlers {
  constructor(
    private jobService: JobService
  ) {}

  processAllJobs = async (req: Request, res: Response) => {
    try {
      const result = await this.jobService.processAllJobs();

      return res.json({
        success: result.success,
        timestamp: result.endTime.toISOString(),
        startTime: result.startTime.toISOString(),
        duration: `${Math.round(result.duration / 1000)}s`,
        message: result.success ? 'Alert processing completed successfully' : 'Alert processing failed',
        results: {
          usersProcessed: result.usersProcessed,
          jobsFound: result.jobsFound,
          notificationsSent: result.notificationsSent
        },
        error: result.error
      });

    } catch (error) {
      console.error('❌ [Job Handler] Unexpected error in processAllJobs:', error);
      return res.status(500).json({
        success: false,
        timestamp: new Date().toISOString(),
        error: 'Unexpected error in job processing',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  };

  cleanupJobs = async (req: Request, res: Response) => {
    try {
      const result = await this.jobService.cleanupJobs(90);

      return res.json({
        success: result.success,
        timestamp: result.endTime.toISOString(),
        startTime: result.startTime.toISOString(),
        duration: `${Math.round(result.duration / 1000)}s`,
        results: {
          deletedJobsCount: result.deletedJobsCount,
          cutoffDate: result.cutoffDate.toISOString()
        },
        error: result.error
      });

    } catch (error) {
      console.error('❌ [Job Handler] Unexpected error in cleanupJobs:', error);
      return res.status(500).json({
        success: false,
        timestamp: new Date().toISOString(),
        error: 'Unexpected error in job cleanup',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  };

  getJobStatus = async (req: Request, res: Response) => {
    try {
      const startTime = new Date();
      console.log(`📊 [${startTime.toISOString()}] GETTING SYSTEM STATUS`);

      // Get database statistics
      const [
        totalUsers,
        activeUsers,
        totalJobSearches,
        activeJobSearches,
        totalJobPostings,
        totalNotifications,
        recentJobs,
        oldJobs
      ] = await Promise.all([
        db.select({ count: count() }).from(users),
        db.select({ count: count() }).from(users).where(sql`active = true`),
        db.select({ count: count() }).from(jobSearches),
        db.select({ count: count() }).from(jobSearches).where(sql`active = true`),
        db.select({ count: count() }).from(jobPostings),
        db.select({ count: count() }).from(userNotifications),
        db.select({ count: count() }).from(jobPostings).where(sql`created_at >= NOW() - INTERVAL '7 days'`),
        db.select({ count: count() }).from(jobPostings).where(sql`created_at < NOW() - INTERVAL '90 days'`)
      ]);

      const endTime = new Date();
      const duration = endTime.getTime() - startTime.getTime();

      console.log(`✅ [${endTime.toISOString()}] SYSTEM STATUS RETRIEVED`);
      console.log(`📊 [Status] Query duration: ${Math.round(duration)}ms`);

      return res.json({
        success: true,
        timestamp: endTime.toISOString(),
        queryDuration: `${Math.round(duration)}ms`,
        system: {
          status: 'healthy',
          service: 'swiszjobs-bot'
        },
        database: {
          users: {
            total: totalUsers[0]?.count || 0,
            active: activeUsers[0]?.count || 0
          },
          jobSearches: {
            total: totalJobSearches[0]?.count || 0,
            active: activeJobSearches[0]?.count || 0
          },
          jobPostings: {
            total: totalJobPostings[0]?.count || 0,
            recentWeek: recentJobs[0]?.count || 0,
            eligibleForCleanup: oldJobs[0]?.count || 0
          },
          notifications: {
            total: totalNotifications[0]?.count || 0
          }
        }
      });
    } catch (error) {
      console.error('❌ [Job Status] Error:', error);
      return res.status(500).json({
        success: false,
        timestamp: new Date().toISOString(),
        error: 'Failed to get job status',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  };
}
