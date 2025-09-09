import express from 'express';
import { db } from '../database/connection.js';
import { users } from '../database/schema.js';
import { eq } from 'drizzle-orm';
import { JobMatch } from '../types/index.js';
import { AlertEngine } from '../services/alertEngine.js';
import { SchedulerService } from '../services/scheduler.js';

export function startAdminServer(port: number, alertEngine: AlertEngine, scheduler?: SchedulerService): void {
  const app = express();
  app.use(express.json());

  // Health check endpoint
  app.get('/health', (req, res) => {
    return res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'swiszjobs-bot'
    });
  });

  // Admin test scraper endpoint
  app.post('/admin/test-scraper', async (req, res) => {
    try {
      const { keywords, locations, chatId } = req.body;

      if (!keywords || !locations || !chatId) {
        return res.status(400).json({
          error: 'Missing required fields: keywords, locations, chatId'
        });
      }


      console.log(`🧪 [Admin Test] Testing scraper with keywords=[${keywords.join(', ')}], locations=[${locations.join(', ')}], chatId=${chatId}`);

      // Test scraping
      const startTime = Date.now();
      const jobs = await alertEngine.jobScraper.scrapeAllSources(keywords, locations);
      const scrapeDuration = Date.now() - startTime;

      // Send test notification if jobs found
      let testNotificationSent = false;
      if (jobs.length > 0) {
        try {
          const testJob = jobs[0]!; // Non-null assertion since we checked jobs.length > 0
          await alertEngine.telegramBot.sendMessage(chatId,
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
  });

  // Admin trigger alerts for specific user
  app.post('/admin/trigger', async (req, res) => {
    try {
      const { chatId } = req.body;

      if (!chatId) {
        return res.status(400).json({
          error: 'Missing required field: chatId'
        });
      }


      console.log(`🎮 [Admin Trigger] Processing alerts for user ${chatId}`);

      const startTime = Date.now();

      // Get user from database
      const user = await db.select().from(users).where(eq(users.telegramChatId, chatId)).limit(1);

      if (user.length === 0) {
        return res.status(404).json({
          error: `User with chatId ${chatId} not found`
        });
      }

      // Process alerts for this specific user
      const userStats = await alertEngine.processUserAlerts(user[0]);
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
  });

  // Admin scheduler status endpoint
  app.get('/admin/scheduler', (req, res) => {
    if (!scheduler) {
      return res.status(500).json({
        error: 'Scheduler not available'
      });
    }

    const nextRunInfo = scheduler.getNextRunTime();
    const taskStatus = scheduler.getTaskStatus();

    return res.json({
      success: true,
      timestamp: new Date().toISOString(),
      scheduler: {
        ...nextRunInfo,
        tasks: taskStatus
      }
    });
  });

  // Manual scheduler trigger - acts as external cron
  app.get('/admin/process-all-alerts', async (req, res) => {
    const startTime = new Date();
    console.log(`🔄 [${startTime.toISOString()}] MANUAL ALERT PROCESSING STARTED (triggered via API)`);
    try {
      await alertEngine.processAllAlerts();

      const endTime = new Date();
      const duration = endTime.getTime() - startTime.getTime();

      console.log(`✅ [${endTime.toISOString()}] MANUAL ALERT PROCESSING COMPLETED SUCCESSFULLY`);
      console.log(`📊 [Manual] Duration: ${Math.round(duration / 1000)}s`);

      return res.json({
        success: true,
        timestamp: endTime.toISOString(),
        startTime: startTime.toISOString(),
        duration: `${Math.round(duration / 1000)}s`,
        message: 'Alert processing completed successfully'
      });

    } catch (error) {
      const endTime = new Date();
      const duration = endTime.getTime() - startTime.getTime();

      console.error(`❌ [${endTime.toISOString()}] MANUAL ALERT PROCESSING FAILED:`, error);
      console.log(`📊 [Manual] Failed after: ${Math.round(duration / 1000)}s`);

      return res.status(500).json({
        success: false,
        timestamp: endTime.toISOString(),
        startTime: startTime.toISOString(),
        duration: `${Math.round(duration / 1000)}s`,
        error: 'Alert processing failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  app.listen(port, () => {
    console.log(`🔧 Admin server listening on port ${port}`);
    console.log(`📋 Available endpoints:`);
    console.log(`   - GET /health (Health check)`);
    console.log(`   - POST /admin/test-scraper (Test job scraping)`);
    console.log(`   - POST /admin/trigger (Trigger user alerts)`);
    console.log(`   - GET /admin/scheduler (Scheduler status)`);
    console.log(`   - GET /admin/process-all-alerts (Manual job processing)`);
  });
}
