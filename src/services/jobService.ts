import { db } from '../database/connection.js';
import { users, jobSearches, jobPostings, userNotifications } from '../database/schema.js';
import { eq, and, notInArray, lt } from 'drizzle-orm';
import { JobMatch } from '../types/index.js';
import { JobScraperService } from './jobScraper.js';
import { TelegramBot } from '../bot/index.js';

export interface ProcessResult {
  success: boolean;
  startTime: Date;
  endTime: Date;
  duration: number;
  usersProcessed: number;
  jobsFound: number;
  notificationsSent: number;
  error?: string;
}

export interface CleanupResult {
  success: boolean;
  startTime: Date;
  endTime: Date;
  duration: number;
  deletedJobsCount: number;
  cutoffDate: Date;
  error?: string;
}

export class JobService {
  public jobScraper: JobScraperService;
  public telegramBot: TelegramBot;

  constructor(jobScraper: JobScraperService, telegramBot: TelegramBot) {
    this.jobScraper = jobScraper;
    this.telegramBot = telegramBot;
  }

  async processAllJobs(): Promise<ProcessResult> {
    const startTime = new Date();
    console.log(`🔄 [${startTime.toISOString()}] ALERT PROCESSING STARTED`);

    try {
      const activeUsers = await db
        .select()
        .from(users)
        .where(eq(users.active, true));

      console.log(`👥 [Job Service] Found ${activeUsers.length} active users to process`);

      let totalJobsFound = 0;
      let totalNotificationsSent = 0;

      for (const user of activeUsers) {
        const userStats = await this.processUserAlerts(user);
        totalJobsFound += userStats.jobsFound;
        totalNotificationsSent += userStats.notificationsSent;
        await this.sleep(1000); // Rate limiting
      }

      const endTime = new Date();
      const duration = endTime.getTime() - startTime.getTime();

      console.log(`✅ [${endTime.toISOString()}] ALERT PROCESSING COMPLETED SUCCESSFULLY`);
      console.log(`📊 [Jobs] Duration: ${Math.round(duration / 1000)}s`);
      console.log(`   👥 Users processed: ${activeUsers.length}`);
      console.log(`   💼 Total jobs found: ${totalJobsFound}`);
      console.log(`   📱 Notifications sent: ${totalNotificationsSent}`);

      return {
        success: true,
        startTime,
        endTime,
        duration,
        usersProcessed: activeUsers.length,
        jobsFound: totalJobsFound,
        notificationsSent: totalNotificationsSent
      };

    } catch (error) {
      const endTime = new Date();
      const duration = endTime.getTime() - startTime.getTime();

      console.error(`❌ [${endTime.toISOString()}] ALERT PROCESSING FAILED:`, error);
      console.log(`📊 [Jobs] Failed after: ${Math.round(duration / 1000)}s`);

      return {
        success: false,
        startTime,
        endTime,
        duration,
        usersProcessed: 0,
        jobsFound: 0,
        notificationsSent: 0,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // Keep the old method for backward compatibility
  async processAllAlerts(): Promise<void> {
    await this.processAllJobs();
  }

  async processUserAlerts(user: any): Promise<{jobsFound: number, notificationsSent: number}> {
    try {
      const userSearches = await db
        .select()
        .from(jobSearches)
        .where(and(
          eq(jobSearches.userId, user.id),
          eq(jobSearches.active, true)
        ));

      if (userSearches.length === 0) {
        console.log(`⚠️  [User ${user.telegramChatId}] No active job searches configured`);
        return { jobsFound: 0, notificationsSent: 0 };
      }

      console.log(`🔍 [User ${user.telegramChatId}] Processing ${userSearches.length} job search(es)`);

      let userJobsFound = 0;
      let userNotificationsSent = 0;

      for (const search of userSearches) {
        const searchStats = await this.processJobSearch(user, search);
        userJobsFound += searchStats.jobsFound;
        userNotificationsSent += searchStats.notificationsSent;
      }

      if (userNotificationsSent > 0) {
        console.log(`📱 [User ${user.telegramChatId}] Sent ${userNotificationsSent} notifications`);
      }

      return { jobsFound: userJobsFound, notificationsSent: userNotificationsSent };
    } catch (error) {
      console.error(`❌ [User ${user.telegramChatId}] Error processing alerts:`, error);
      return { jobsFound: 0, notificationsSent: 0 };
    }
  }

  private async processJobSearch(user: any, search: any): Promise<{jobsFound: number, notificationsSent: number}> {
    try {
      const searchCriteria = `"${search.keywords.join(', ')}" in [${search.locations.join(', ')}]`;
      console.log(`🔍 [User ${user.telegramChatId}] Searching: ${searchCriteria}`);

      const scrapeStart = Date.now();
      const jobs = await this.jobScraper.scrapeAllSources(search.keywords, search.locations);
      const scrapeDuration = Date.now() - scrapeStart;

      console.log(`📊 [User ${user.telegramChatId}] Scraping completed in ${Math.round(scrapeDuration/1000)}s - Found ${jobs.length} total jobs`);

      const newJobs = await this.filterNewJobs(jobs, search.maxAgeDays);
      console.log(`📅 [User ${user.telegramChatId}] ${newJobs.length} jobs within ${search.maxAgeDays} day(s)`);

      if (newJobs.length === 0) {
        console.log(`📭 [User ${user.telegramChatId}] No recent jobs found`);
        return { jobsFound: 0, notificationsSent: 0 };
      }

      const unseenJobs = await this.filterUnseenJobs(newJobs, user.id);
      console.log(`👁️  [User ${user.telegramChatId}] ${unseenJobs.length} unseen jobs (${newJobs.length - unseenJobs.length} already seen)`);

      if (unseenJobs.length === 0) {
        console.log(`✅ [User ${user.telegramChatId}] All jobs already notified`);
        return { jobsFound: newJobs.length, notificationsSent: 0 };
      }

      await this.saveNewJobs(unseenJobs);
      await this.sendJobAlerts(user.telegramChatId, unseenJobs);
      await this.recordNotifications(user.id, unseenJobs);

      console.log(`🎯 [User ${user.telegramChatId}] Successfully sent ${unseenJobs.length} job alerts for criteria: ${searchCriteria}`);

      // Log job details for debugging
      unseenJobs.forEach((job, index) => {
        console.log(`   ${index + 1}. "${job.title}" at ${job.company} (${job.location}) - ${job.source}`);
      });

      return { jobsFound: newJobs.length, notificationsSent: unseenJobs.length };
    } catch (error) {
      console.error(`❌ [User ${user.telegramChatId}] Error processing job search for "${search.keywords.join(', ')}":`, error);
      return { jobsFound: 0, notificationsSent: 0 };
    }
  }

  private async filterNewJobs(jobs: JobMatch[], maxAgeDays: number): Promise<JobMatch[]> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - maxAgeDays);

    return jobs.filter(job => job.postedDate >= cutoffDate);
  }

  private async filterUnseenJobs(jobs: JobMatch[], userId: number): Promise<JobMatch[]> {
    if (jobs.length === 0) return [];

    const seenJobIds = await db
      .select({ jobPostingId: userNotifications.jobPostingId })
      .from(userNotifications)
      .innerJoin(jobPostings, eq(userNotifications.jobPostingId, jobPostings.id))
      .where(
        and(
          eq(userNotifications.userId, userId),
          notInArray(jobPostings.externalId, jobs.map(j => j.id))
        )
      );

    const seenIds = new Set(seenJobIds.map(s => s.jobPostingId));

    const unseenJobs: JobMatch[] = [];

    for (const job of jobs) {
      const existingJob = await db
        .select()
        .from(jobPostings)
        .where(eq(jobPostings.externalId, job.id))
        .limit(1);

      if (existingJob.length === 0 || !seenIds.has(existingJob[0]!.id)) {
        unseenJobs.push(job);
      }
    }

    return unseenJobs;
  }

  private async saveNewJobs(jobs: JobMatch[]): Promise<void> {
    for (const job of jobs) {
      try {
        const existing = await db
          .select()
          .from(jobPostings)
          .where(eq(jobPostings.externalId, job.id))
          .limit(1);

        if (existing.length === 0) {
          await db.insert(jobPostings).values({
            externalId: job.id,
            title: job.title,
            company: job.company,
            location: job.location,
            url: job.url,
            description: job.description || null,
            postedDate: job.postedDate,
            source: job.source
          });
        }
      } catch (error) {
        console.error(`❌ Error saving job ${job.id}:`, error);
      }
    }
  }

  private async sendJobAlerts(chatId: string, jobs: JobMatch[]): Promise<void> {
    for (const job of jobs) {
      try {
        const message = this.formatJobMessage(job);
        await this.telegramBot.sendMessage(chatId, message, { parse_mode: 'HTML' });
        await this.sleep(500); // Rate limiting
      } catch (error) {
        console.error(`❌ Error sending job alert:`, error);
      }
    }
  }

  private formatJobMessage(job: JobMatch): string {
    const postedDate = job.postedDate.toLocaleDateString('fr-FR');

    return `🔔 <b>Nouvelle offre d'emploi!</b>

📋 <b>Titre:</b> ${job.title}
🏢 <b>Entreprise:</b> ${job.company}
📍 <b>Lieu:</b> ${job.location}
📅 <b>Publié:</b> ${postedDate}
🔗 <a href="${job.url}">📋 Postuler maintenant</a>

<i>Tapez /pause pour arrêter les alertes</i>`;
  }

  private async recordNotifications(userId: number, jobs: JobMatch[]): Promise<void> {
    for (const job of jobs) {
      try {
        const jobRecord = await db
          .select()
          .from(jobPostings)
          .where(eq(jobPostings.externalId, job.id))
          .limit(1);

        if (jobRecord.length > 0) {
          await db.insert(userNotifications).values({
            userId: userId,
            jobPostingId: jobRecord[0]!.id
          });
        }
      } catch (error) {
        console.error(`❌ Error recording notification:`, error);
      }
    }
  }

  async cleanupJobs(retentionDays: number = 90): Promise<CleanupResult> {
    const startTime = new Date();
    console.log(`🧹 [${startTime.toISOString()}] DATABASE CLEANUP STARTED`);

    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

      // Delete old job postings (cascades to user_notifications)
      const deletedJobs = await db
        .delete(jobPostings)
        .where(lt(jobPostings.createdAt, cutoffDate))
        .returning({ id: jobPostings.id });

      const endTime = new Date();
      const duration = endTime.getTime() - startTime.getTime();

      console.log(`✅ [${endTime.toISOString()}] DATABASE CLEANUP COMPLETED`);
      console.log(`📊 [Cleanup] Deleted ${deletedJobs.length} jobs older than ${retentionDays} days`);
      console.log(`📊 [Cleanup] Duration: ${Math.round(duration / 1000)}s`);

      return {
        success: true,
        startTime,
        endTime,
        duration,
        deletedJobsCount: deletedJobs.length,
        cutoffDate
      };

    } catch (error) {
      const endTime = new Date();
      const duration = endTime.getTime() - startTime.getTime();

      console.error(`❌ [${endTime.toISOString()}] DATABASE CLEANUP FAILED:`, error);
      console.log(`📊 [Cleanup] Failed after: ${Math.round(duration / 1000)}s`);

      return {
        success: false,
        startTime,
        endTime,
        duration,
        deletedJobsCount: 0,
        cutoffDate: new Date(),
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
