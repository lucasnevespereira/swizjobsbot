import { db } from '../database/connection.js';
import { users, jobSearches, jobPostings, userNotifications } from '../database/schema.js';
import { eq, and, notInArray, gte } from 'drizzle-orm';
import { JobMatch } from '../types/index.js';
import { JobScraperService } from './jobScraper.js';
import { TelegramBot } from '../bot/index.js';

export class AlertEngine {
  private jobScraper: JobScraperService;
  private telegramBot: TelegramBot;

  constructor(jobScraper: JobScraperService, telegramBot: TelegramBot) {
    this.jobScraper = jobScraper;
    this.telegramBot = telegramBot;
  }

  async processAllAlerts(): Promise<void> {
    console.log('🚀 Starting alert processing...');

    try {
      const activeUsers = await db
        .select()
        .from(users)
        .where(eq(users.active, true));

      console.log(`👥 Processing alerts for ${activeUsers.length} active users`);

      for (const user of activeUsers) {
        await this.processUserAlerts(user);
        await this.sleep(1000); // Rate limiting
      }

      console.log('✅ Alert processing completed');
    } catch (error) {
      console.error('❌ Error in alert processing:', error);
      throw error;
    }
  }

  private async processUserAlerts(user: any): Promise<void> {
    try {
      const userSearches = await db
        .select()
        .from(jobSearches)
        .where(and(
          eq(jobSearches.userId, user.id),
          eq(jobSearches.active, true)
        ));

      if (userSearches.length === 0) {
        console.log(`⚠️ No active searches for user ${user.telegramChatId}`);
        return;
      }

      for (const search of userSearches) {
        await this.processJobSearch(user, search);
      }
    } catch (error) {
      console.error(`❌ Error processing alerts for user ${user.telegramChatId}:`, error);
    }
  }

  private async processJobSearch(user: any, search: any): Promise<void> {
    try {
      console.log(`🔍 Processing search for user ${user.telegramChatId}: ${search.keywords.join(', ')}`);

      const jobs = await this.jobScraper.scrapeAllSources(search.keywords, search.locations);
      
      const newJobs = await this.filterNewJobs(jobs, search.maxAgeDays);
      
      if (newJobs.length === 0) {
        console.log(`📭 No new jobs found for user ${user.telegramChatId}`);
        return;
      }

      const unseenJobs = await this.filterUnseenJobs(newJobs, user.id);
      
      if (unseenJobs.length === 0) {
        console.log(`👁️ No unseen jobs for user ${user.telegramChatId}`);
        return;
      }

      await this.saveNewJobs(unseenJobs);
      await this.sendJobAlerts(user.telegramChatId, unseenJobs);
      await this.recordNotifications(user.id, unseenJobs);

      console.log(`📱 Sent ${unseenJobs.length} job alerts to user ${user.telegramChatId}`);
    } catch (error) {
      console.error(`❌ Error processing job search:`, error);
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
🔗 <b>Postuler:</b> <a href="${job.url}">Voir l'offre</a>

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

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}