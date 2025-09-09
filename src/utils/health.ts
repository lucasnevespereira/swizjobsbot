import { createServer } from 'http';
import { URL } from 'url';
import { JobMatch } from '../types/index.js';

let alertEngine: any = null;

export function setAlertEngine(engine: any): void {
  alertEngine = engine;
}

export function startHealthServer(port: number = 3000): void {
  const server = createServer(async (req, res) => {
    const url = new URL(req.url || '', `http://localhost:${port}`);

    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(200);
      res.end();
      return;
    }

    if (url.pathname === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        service: 'swiszjobs-bot'
      }));
    }
    else if (url.pathname === '/admin/test-scraper' && req.method === 'POST') {
      await handleTestScraper(req, res);
    }
    else {
      res.writeHead(404);
      res.end('Not Found');
    }
  });

  server.listen(port, () => {
    console.log(`🏥 Health check server listening on port ${port}`);
    console.log(`🔧 Admin test endpoint: POST /admin/test-scraper`);
  });
}

async function handleTestScraper(req: any, res: any): Promise<void> {
  try {
    let body = '';
    for await (const chunk of req) {
      body += chunk.toString();
    }

    const data = JSON.parse(body);
    const { keywords, locations, chatId } = data;

    if (!keywords || !locations || !chatId) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        error: 'Missing required fields: keywords, locations, chatId'
      }));
      return;
    }

    if (!alertEngine) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        error: 'Alert engine not initialized'
      }));
      return;
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
        const testJob = jobs[0]; // Send first job as test
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

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(response, null, 2));

  } catch (error) {
    console.error('❌ [Admin Test] Error:', error);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }));
  }
}
