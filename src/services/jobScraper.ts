import { getJson } from 'serpapi';
import { JobMatch, ScrapingResult } from '../types/index.js';

export class JobScraperService {
  private serpApiKey: string;

  constructor(serpApiKey: string) {
    this.serpApiKey = serpApiKey;
  }


  async scrapeJobsFromGoogle(keywords: string[], locations: string[]): Promise<ScrapingResult> {
    try {
      const jobs: JobMatch[] = [];

      for (const keyword of keywords) {
        for (const location of locations) {
          const searchQuery = `${keyword} jobs in ${location} Switzerland`;

          const response = await getJson({
            engine: "google_jobs",
            q: searchQuery,
            hl: "fr",
            api_key: this.serpApiKey,
            num: 20
          });

          if (response.jobs_results) {
            response.jobs_results.forEach((job: any) => {
              jobs.push({
                id: job.job_id || job.link,
                title: job.title,
                company: job.company_name,
                location: job.location,
                url: job.share_link || job.link,
                description: job.description,
                postedDate: this.parseGoogleDate(job.detected_extensions?.posted_at),
                source: 'google' as const
              });
            });
          }
        }
      }

      return {
        jobs: this.deduplicateJobs(jobs),
        success: true
      };
    } catch (error) {
      console.error('Google Jobs scraping error:', error);
      return {
        jobs: [],
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async scrapeAllSources(keywords: string[], locations: string[]): Promise<JobMatch[]> {
    const searchId = `${keywords.join('+')}_${locations.join('+')}`.substring(0, 20);
    const startTime = Date.now();

    console.log(`🔍 [Scraper ${searchId}] Starting Google Jobs scraping:`);
    console.log(`   🎯 Keywords: [${keywords.join(', ')}]`);
    console.log(`   📍 Locations: [${locations.join(', ')}]`);

    const googleResult = await this.scrapeJobsFromGoogle(keywords, locations);

    let allJobs: JobMatch[] = [];

    if (googleResult.success) {
      allJobs.push(...googleResult.jobs);
      console.log(`✅ [Scraper ${searchId}] Google Jobs: ${googleResult.jobs.length} jobs found`);
    } else {
      console.error(`❌ [Scraper ${searchId}] Google Jobs scraping failed:`, googleResult.error);
    }

    // Remove duplicates
    const beforeDedup = allJobs.length;
    const uniqueJobs = this.deduplicateJobs(allJobs);
    const duration = Date.now() - startTime;

    console.log(`📊 [Scraper ${searchId}] Completed in ${Math.round(duration/1000)}s:`);
    console.log(`   📈 Source: Google Jobs (${googleResult.jobs.length})`);
    console.log(`   🔢 Raw jobs: ${beforeDedup}, Unique: ${uniqueJobs.length} (${beforeDedup - uniqueJobs.length} duplicates removed)`);

    if (uniqueJobs.length > 0) {
      console.log(`   💼 Recent jobs sample:`);
      uniqueJobs.slice(0, 3).forEach((job, i) => {
        console.log(`     ${i + 1}. "${job.title}" at ${job.company} (${job.source})`);
      });
      if (uniqueJobs.length > 3) {
        console.log(`     ... and ${uniqueJobs.length - 3} more jobs`);
      }
    }

    return uniqueJobs;
  }

  private deduplicateJobs(jobs: JobMatch[]): JobMatch[] {
    const seen = new Set<string>();
    const uniqueJobs: JobMatch[] = [];

    for (const job of jobs) {
      const key = this.generateJobKey(job);
      if (!seen.has(key)) {
        seen.add(key);
        uniqueJobs.push(job);
      }
    }

    return uniqueJobs;
  }

  private generateJobKey(job: JobMatch): string {
    return `${job.title.toLowerCase().trim()}-${job.company.toLowerCase().trim()}-${job.location.toLowerCase().trim()}`;
  }

  private parseGoogleDate(dateStr?: string): Date {
    if (!dateStr) return new Date();

    const now = new Date();
    const lowerDate = dateStr.toLowerCase();

    if (lowerDate.includes('hour')) {
      const hours = parseInt(lowerDate.match(/(\d+)/)?.[1] || '1');
      return new Date(now.getTime() - hours * 60 * 60 * 1000);
    }

    if (lowerDate.includes('day')) {
      const days = parseInt(lowerDate.match(/(\d+)/)?.[1] || '1');
      return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    }

    if (lowerDate.includes('week')) {
      const weeks = parseInt(lowerDate.match(/(\d+)/)?.[1] || '1');
      return new Date(now.getTime() - weeks * 7 * 24 * 60 * 60 * 1000);
    }

    return new Date();
  }
}
