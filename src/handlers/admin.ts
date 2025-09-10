import { Request, Response } from 'express';
import { db } from '../database/connection.js';
import { users } from '../database/schema.js';
import { eq } from 'drizzle-orm';
import { JobMatch } from '../types/index.js';
import { JobService } from '../services/jobService.js';
import { TelegramBot } from '../bot/index.js';
import { SchedulerService } from '../services/scheduler.js';

export class AdminHandlers {
  constructor(
    private jobService: JobService,
    private telegramBot: TelegramBot,
    private scheduler?: SchedulerService
  ) {}

  healthCheck = (req: Request, res: Response) => {
    return res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'swiszjobs-bot'
    });
  };


  testScraper = async (req: Request, res: Response) => {
    try {
      const { keywords, locations, chatId } = req.body;

      if (!keywords || !locations || !chatId) {
        return res.status(400).json({
          error: 'Missing required fields: keywords, locations, chatId'
        });
      }

      console.log(`🧪 [Admin Test] Testing scraper with keywords=[${keywords.join(', ')}], locations=[${locations.join(', ')}], chatId=${chatId}`);

      const startTime = Date.now();
      const jobs = await this.jobService.jobScraper.scrapeAllSources(keywords, locations);
      const scrapeDuration = Date.now() - startTime;

      let testNotificationSent = false;
      if (jobs.length > 0) {
        try {
          const testJob = jobs[0]!;
          await this.telegramBot.sendMessage(chatId,
            `
            🔔 <b>Nouvelle offre d'emploi!</b>

            📋 <b>Titre:</b> ${testJob.title}
            🏢 <b>Entreprise:</b> ${testJob.company}
            📍 <b>Lieu:</b> ${testJob.location}
            📅 <b>Publié:</b> ${testJob.postedDate.toLocaleDateString('fr-FR')}
            🔗 <a href="${testJob.url}">📋 Postuler maintenant</a>

            <i>🔧 Cette alerte a été envoyée manuellement par l'administrateur</i>`,
            { parse_mode: 'HTML' }
          );
          testNotificationSent = true;
          console.log(`📱 [Admin Test] Test notification sent to ${chatId}`);
        } catch (notifError) {
          console.error(`❌ [Admin Test] Failed to send test notification:`, notifError);
        }
      }

      const response = {
        success: true,
        timestamp: new Date().toISOString(),
        testCriteria: {
          keywords,
          locations,
          chatId
        },
        results: {
          totalJobs: jobs.length,
          scrapingDuration: `${Math.round(scrapeDuration/1000)}s`,
          testNotificationSent,
          jobsSample: jobs.slice(0, 5).map((job: JobMatch) => ({
            title: job.title,
            company: job.company,
            location: job.location,
            source: job.source,
            postedDate: job.postedDate
          }))
        }
      };

      console.log(`✅ [Admin Test] Completed - found ${jobs.length} jobs, notification sent: ${testNotificationSent}`);
      return res.json(response);

    } catch (error) {
      console.error('❌ [Admin Test] Error:', error);
      return res.status(500).json({
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  };

  triggerUserAlerts = async (req: Request, res: Response) => {
    try {
      const { chatId } = req.body;

      if (!chatId) {
        return res.status(400).json({
          error: 'Missing required field: chatId'
        });
      }

      console.log(`🎮 [Admin Trigger] Processing alerts for user ${chatId}`);

      const startTime = Date.now();

      const user = await db.select().from(users).where(eq(users.telegramChatId, chatId)).limit(1);

      if (user.length === 0) {
        return res.status(404).json({
          error: `User with chatId ${chatId} not found`
        });
      }

      const userStats = await this.jobService.processUserAlerts(user[0]);
      const duration = Date.now() - startTime;

      const response = {
        success: true,
        timestamp: new Date().toISOString(),
        user: {
          chatId,
          firstName: user[0]?.firstName,
          username: user[0]?.username
        },
        results: {
          duration: `${Math.round(duration/1000)}s`,
          jobsFound: userStats.jobsFound,
          notificationsSent: userStats.notificationsSent
        }
      };

      console.log(`✅ [Admin Trigger] Completed for user ${chatId} - ${userStats.notificationsSent} notifications sent`);
      return res.json(response);

    } catch (error) {
      console.error('❌ [Admin Trigger] Error:', error);
      return res.status(500).json({
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  };

  schedulerStatus = (req: Request, res: Response) => {
    if (!this.scheduler) {
      return res.status(500).json({
        error: 'Scheduler not available'
      });
    }

    const nextRunInfo = this.scheduler.getNextRunTime();
    const taskStatus = this.scheduler.getTaskStatus();

    return res.json({
      success: true,
      timestamp: new Date().toISOString(),
      scheduler: {
        ...nextRunInfo,
        tasks: taskStatus
      }
    });
  };
}
