import { db } from '../database/connection.js';
import { users, jobSearches, jobPostings, userNotifications } from '../database/schema.js';
import { eq, and, inArray, lt } from 'drizzle-orm';
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

interface SearchCriteria {
  key: string;
  keywords: string[];
  locations: string[];
}

interface UserWithSearch {
  user: typeof users.$inferSelect;
  search: typeof jobSearches.$inferSelect;
  criteriaKey: string;
}

export class JobService {
  public jobScraper: JobScraperService;
  public telegramBot: TelegramBot;

  constructor(jobScraper: JobScraperService, telegramBot: TelegramBot) {
    this.jobScraper = jobScraper;
    this.telegramBot = telegramBot;
  }

  /**
   * Build a unique key for a (keywords, locations) combo so we can deduplicate scrapes.
   */
  private buildCriteriaKey(keywords: string[], locations: string[]): string {
    const sortedKw = [...keywords].map(k => k.toLowerCase().trim()).sort().join('|');
    const sortedLoc = [...locations].map(l => l.toLowerCase().trim()).sort().join('|');
    return `${sortedKw}::${sortedLoc}`;
  }

  /**
   * Main entry point: collect all active searches, scrape once per unique criteria,
   * then distribute results to matching users.
   */
  async processAllJobs(): Promise<ProcessResult> {
    const startTime = new Date();
    console.log(`🔄 [${startTime.toISOString()}] ALERT PROCESSING STARTED`);

    try {
      // 1. Get all active users with their active searches in one query
      const activeSearches = await db
        .select({ user: users, search: jobSearches })
        .from(users)
        .innerJoin(jobSearches, eq(users.id, jobSearches.userId))
        .where(and(eq(users.active, true), eq(jobSearches.active, true)));

      if (activeSearches.length === 0) {
        console.log('📭 No active users with configured searches');
        return this.buildResult(startTime, true, 0, 0, 0);
      }

      // 2. Deduplicate search criteria across all users
      const criteriaMap = new Map<string, SearchCriteria>();
      const userSearchList: UserWithSearch[] = [];

      for (const { user, search } of activeSearches) {
        const key = this.buildCriteriaKey(search.keywords, search.locations);
        if (!criteriaMap.has(key)) {
          criteriaMap.set(key, { key, keywords: search.keywords, locations: search.locations });
        }
        userSearchList.push({ user, search, criteriaKey: key });
      }

      const uniqueUserCount = new Set(activeSearches.map(s => s.user.id)).size;
      console.log(`👥 ${uniqueUserCount} active users, ${activeSearches.length} searches, ${criteriaMap.size} unique criteria`);

      // 3. Scrape once per unique criteria
      const jobsByCriteria = new Map<string, JobMatch[]>();
      let totalJobsFound = 0;

      for (const [key, criteria] of criteriaMap) {
        console.log(`🔍 Scraping: "${criteria.keywords.join(', ')}" in [${criteria.locations.join(', ')}]`);
        const jobs = await this.jobScraper.scrapeAllSources(criteria.keywords, criteria.locations);
        jobsByCriteria.set(key, jobs);
        totalJobsFound += jobs.length;
        console.log(`   Found ${jobs.length} jobs`);
      }

      // 4. Save all scraped jobs to DB in batch
      const allJobs = Array.from(jobsByCriteria.values()).flat();
      await this.saveNewJobs(allJobs);

      // 5. Distribute to each user
      let totalNotificationsSent = 0;
      const processedUsers = new Set<number>();

      for (const { user, search, criteriaKey } of userSearchList) {
        const jobs = jobsByCriteria.get(criteriaKey) || [];
        if (jobs.length === 0) continue;

        // Filter by relevance (title/description must match at least one keyword)
        const relevantJobs = this.filterRelevantJobs(jobs, search.keywords);

        // Filter by this user's maxAgeDays
        const recentJobs = this.filterRecentJobs(relevantJobs, search.maxAgeDays);
        if (recentJobs.length === 0) {
          console.log(`📭 [User ${user.telegramChatId}] ${jobs.length} scraped → ${relevantJobs.length} relevant → 0 recent`);
          continue;
        }

        // Filter out jobs already sent to this user (correct dedup)
        const unseenJobs = await this.filterUnseenJobs(recentJobs, user.id);
        if (unseenJobs.length === 0) {
          console.log(`✅ [User ${user.telegramChatId}] All ${recentJobs.length} jobs already sent`);
          continue;
        }

        console.log(`📱 [User ${user.telegramChatId}] ${jobs.length} scraped → ${relevantJobs.length} relevant → ${unseenJobs.length} new`);

        await this.sendJobAlerts(user.telegramChatId, unseenJobs);
        await this.recordNotifications(user.id, unseenJobs);

        totalNotificationsSent += unseenJobs.length;
        processedUsers.add(user.id);
        await this.sleep(1000);
      }

      return this.buildResult(startTime, true, processedUsers.size, totalJobsFound, totalNotificationsSent);
    } catch (error) {
      console.error(`❌ [${new Date().toISOString()}] ALERT PROCESSING FAILED:`, error);
      return this.buildResult(startTime, false, 0, 0, 0, error);
    }
  }

  /**
   * Process alerts for a single user (used by admin trigger endpoint).
   */
  async processUserAlerts(user: any): Promise<{ jobsFound: number; notificationsSent: number }> {
    try {
      const searches = await db
        .select()
        .from(jobSearches)
        .where(and(eq(jobSearches.userId, user.id), eq(jobSearches.active, true)));

      if (searches.length === 0) {
        console.log(`⚠️ [User ${user.telegramChatId}] No active job searches configured`);
        return { jobsFound: 0, notificationsSent: 0 };
      }

      let totalJobsFound = 0;
      let totalNotificationsSent = 0;

      for (const search of searches) {
        const jobs = await this.jobScraper.scrapeAllSources(search.keywords, search.locations);
        const relevantJobs = this.filterRelevantJobs(jobs, search.keywords);
        const recentJobs = this.filterRecentJobs(relevantJobs, search.maxAgeDays);
        totalJobsFound += recentJobs.length;

        if (recentJobs.length === 0) continue;

        await this.saveNewJobs(recentJobs);

        const unseenJobs = await this.filterUnseenJobs(recentJobs, user.id);
        if (unseenJobs.length === 0) {
          console.log(`✅ [User ${user.telegramChatId}] All ${recentJobs.length} jobs already sent`);
          continue;
        }

        console.log(`📱 [User ${user.telegramChatId}] ${jobs.length} scraped → ${relevantJobs.length} relevant → ${unseenJobs.length} new`);
        await this.sendJobAlerts(user.telegramChatId, unseenJobs);
        await this.recordNotifications(user.id, unseenJobs);
        totalNotificationsSent += unseenJobs.length;
      }

      return { jobsFound: totalJobsFound, notificationsSent: totalNotificationsSent };
    } catch (error) {
      console.error(`❌ [User ${user.telegramChatId}] Error:`, error);
      return { jobsFound: 0, notificationsSent: 0 };
    }
  }

  // Backward compatibility for admin handler
  async processAllAlerts(): Promise<void> {
    await this.processAllJobs();
  }

  /**
   * Keep only jobs posted within the last maxAgeDays.
   */
  private filterRecentJobs(jobs: JobMatch[], maxAgeDays: number): JobMatch[] {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - maxAgeDays);
    return jobs.filter(job => job.postedDate >= cutoff);
  }

  /**
   * Keep only jobs where the title or description matches at least one keyword.
   * Uses accent-insensitive matching so "recrutement" matches "Recrutement", etc.
   */
  private filterRelevantJobs(jobs: JobMatch[], keywords: string[]): JobMatch[] {
    const normalize = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const normalizedKeywords = keywords.map(normalize);

    return jobs.filter(job => {
      const title = normalize(job.title);
      const description = normalize(job.description || '');

      return normalizedKeywords.some(kw => title.includes(kw) || description.includes(kw));
    });
  }

  /**
   * FIXED dedup: single batch query to find which jobs in the batch
   * have already been sent to this user.
   *
   * Old code used notInArray (inverted logic) + N individual queries.
   * New code: one query with inArray on the current batch's externalIds.
   */
  private async filterUnseenJobs(jobs: JobMatch[], userId: number): Promise<JobMatch[]> {
    if (jobs.length === 0) return [];

    const externalIds = jobs.map(j => j.id);

    // Single query: which externalIds in this batch were already sent to this user?
    const alreadySent = await db
      .select({ externalId: jobPostings.externalId })
      .from(userNotifications)
      .innerJoin(jobPostings, eq(userNotifications.jobPostingId, jobPostings.id))
      .where(
        and(
          eq(userNotifications.userId, userId),
          inArray(jobPostings.externalId, externalIds)
        )
      );

    const sentIds = new Set(alreadySent.map(r => r.externalId));
    return jobs.filter(job => !sentIds.has(job.id));
  }

  /**
   * Batch save new jobs. One query to check existing, one batch insert for new ones.
   * Replaces the old N+1 pattern (1 SELECT + 1 INSERT per job).
   */
  private async saveNewJobs(jobs: JobMatch[]): Promise<void> {
    if (jobs.length === 0) return;

    // Deduplicate within the batch by externalId
    const uniqueJobs = new Map<string, JobMatch>();
    for (const job of jobs) {
      if (!uniqueJobs.has(job.id)) {
        uniqueJobs.set(job.id, job);
      }
    }
    const deduped = Array.from(uniqueJobs.values());

    const externalIds = deduped.map(j => j.id);

    // Batch check which jobs already exist
    const existing = await db
      .select({ externalId: jobPostings.externalId })
      .from(jobPostings)
      .where(inArray(jobPostings.externalId, externalIds));

    const existingIds = new Set(existing.map(r => r.externalId));
    const newJobs = deduped.filter(j => !existingIds.has(j.id));

    if (newJobs.length === 0) return;

    // Batch insert with ON CONFLICT safety net (requires UNIQUE on externalId)
    await db
      .insert(jobPostings)
      .values(
        newJobs.map(job => ({
          externalId: job.id,
          title: job.title,
          company: job.company,
          location: job.location,
          url: job.url,
          description: job.description || null,
          postedDate: job.postedDate,
          source: job.source,
        }))
      )
      .onConflictDoNothing();

    console.log(`💾 Saved ${newJobs.length} new jobs to DB`);
  }

  /**
   * Batch record that these jobs were sent to this user.
   * One query to look up IDs, one batch insert.
   * Replaces the old N+1 pattern.
   */
  private async recordNotifications(userId: number, jobs: JobMatch[]): Promise<void> {
    if (jobs.length === 0) return;

    const externalIds = jobs.map(j => j.id);

    // Batch lookup job posting DB IDs
    const jobRecords = await db
      .select({ id: jobPostings.id, externalId: jobPostings.externalId })
      .from(jobPostings)
      .where(inArray(jobPostings.externalId, externalIds));

    const idMap = new Map(jobRecords.map(r => [r.externalId, r.id]));

    const values = jobs
      .map(job => {
        const jobPostingId = idMap.get(job.id);
        if (!jobPostingId) return null;
        return { userId, jobPostingId };
      })
      .filter((v): v is { userId: number; jobPostingId: number } => v !== null);

    if (values.length === 0) return;

    // Batch insert with ON CONFLICT safety net (requires UNIQUE on userId+jobPostingId)
    await db.insert(userNotifications).values(values).onConflictDoNothing();
  }

  private async sendJobAlerts(chatId: string, jobs: JobMatch[]): Promise<void> {
    for (const job of jobs) {
      try {
        const message = this.formatJobMessage(job);
        await this.telegramBot.sendMessage(chatId, message, { parse_mode: 'HTML' });
        await this.sleep(500);
      } catch (error) {
        console.error(`❌ Error sending alert to ${chatId}:`, error);
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

  async cleanupJobs(retentionDays: number = 90): Promise<CleanupResult> {
    const startTime = new Date();
    console.log(`🧹 [${startTime.toISOString()}] DATABASE CLEANUP STARTED`);

    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

      const deletedJobs = await db
        .delete(jobPostings)
        .where(lt(jobPostings.createdAt, cutoffDate))
        .returning({ id: jobPostings.id });

      const endTime = new Date();
      const duration = endTime.getTime() - startTime.getTime();

      console.log(`✅ [Cleanup] Deleted ${deletedJobs.length} jobs older than ${retentionDays} days in ${Math.round(duration / 1000)}s`);

      return { success: true, startTime, endTime, duration, deletedJobsCount: deletedJobs.length, cutoffDate };
    } catch (error) {
      const endTime = new Date();
      const duration = endTime.getTime() - startTime.getTime();

      console.error(`❌ [Cleanup] Failed:`, error);

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

  private buildResult(
    startTime: Date,
    success: boolean,
    usersProcessed: number,
    jobsFound: number,
    notificationsSent: number,
    error?: unknown
  ): ProcessResult {
    const endTime = new Date();
    const duration = endTime.getTime() - startTime.getTime();
    const level = success ? '✅' : '❌';

    console.log(`${level} [${endTime.toISOString()}] ALERT PROCESSING ${success ? 'COMPLETED' : 'FAILED'}`);
    console.log(`📊 Duration: ${Math.round(duration / 1000)}s | Users: ${usersProcessed} | Jobs: ${jobsFound} | Sent: ${notificationsSent}`);

    return {
      success,
      startTime,
      endTime,
      duration,
      usersProcessed,
      jobsFound,
      notificationsSent,
      ...(error ? { error: error instanceof Error ? error.message : 'Unknown error' } : {})
    };
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
