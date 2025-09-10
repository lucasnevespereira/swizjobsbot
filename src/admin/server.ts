import express from 'express';
import { AdminHandlers } from './handlers.js';

export class AdminServer {
  private app: express.Application;
  private adminHandlers: AdminHandlers;

  constructor(adminHandlers: AdminHandlers) {
    this.app = express();
    this.adminHandlers = adminHandlers;
    this.setupMiddleware();
    this.setupRoutes();
  }

  private setupMiddleware(): void {
    this.app.use(express.json());
  }

  private setupRoutes(): void {
    // Health check
    this.app.get('/health', this.adminHandlers.healthCheck);

    // Admin routes
    this.app.post('/admin/test', this.adminHandlers.testScraper);
    this.app.post('/admin/trigger', this.adminHandlers.triggerUserAlerts);
    this.app.get('/admin/scheduler', this.adminHandlers.schedulerStatus);

    // Job management routes
    this.app.get('/jobs/process', this.adminHandlers.processAllJobs);
    this.app.get('/jobs/status', this.adminHandlers.getJobStatus);
    this.app.post('/jobs/cleanup', this.adminHandlers.cleanupJobs);
  }

  start(port: number): Promise<void> {
    return new Promise((resolve) => {
      this.app.listen(port, () => {
        console.log(`🔧 Admin server listening on port ${port}`);
        console.log(`📋 Available endpoints:`);
        console.log(`   - GET /health (Health check)`);
        console.log(`   - POST /admin/test (Test job scraping)`);
        console.log(`   - POST /admin/trigger (Trigger user alerts)`);
        console.log(`   - GET /admin/scheduler (Scheduler status)`);
        console.log(`   - GET /jobs/process (Job processing)`);
        console.log(`   - GET /jobs/status (Job status)`);
        console.log(`   - POST /jobs/cleanup (Job cleanup)`);
        resolve();
      });
    });
  }
}
