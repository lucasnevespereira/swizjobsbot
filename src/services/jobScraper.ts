import { ApifyClient } from 'apify-client';
import { getJson } from 'serpapi';
import { JobMatch, ScrapingResult } from '../types/index.js';

export class JobScraperService {
  private apifyClient: ApifyClient;
  private serpApiKey: string;

  constructor(apifyToken: string, serpApiKey: string) {
    this.apifyClient = new ApifyClient({ token: apifyToken });
    this.serpApiKey = serpApiKey;
  }

  async scrapeJobsFromJobup(keywords: string[], locations: string[]): Promise<ScrapingResult> {
    try {
      const actorId = 'drobnikj/jobup-scraper';
      
      const input = {
        queries: keywords.map(keyword => ({
          keyword,
          location: locations.join(','),
          maxItems: 50
        }))
      };

      const run = await this.apifyClient.actor(actorId).call(input);
      const { items } = await this.apifyClient.dataset(run.defaultDatasetId).listItems();

      const jobs: JobMatch[] = items.map((item: any) => ({
        id: item.id || item.url,
        title: item.title,
        company: item.company,
        location: item.location,
        url: item.url,
        description: item.description,
        postedDate: new Date(item.posted || Date.now()),
        source: 'jobup' as const
      }));

      return {
        jobs,
        success: true
      };
    } catch (error) {
      console.error('Jobup scraping error:', error);
      return {
        jobs: [],
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
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
    console.log(`🔍 Scraping jobs for keywords: ${keywords.join(', ')} in locations: ${locations.join(', ')}`);

    const [jobupResult, googleResult] = await Promise.all([
      this.scrapeJobsFromJobup(keywords, locations),
      this.scrapeJobsFromGoogle(keywords, locations)
    ]);

    let allJobs: JobMatch[] = [];

    if (jobupResult.success) {
      allJobs.push(...jobupResult.jobs);
      console.log(`✅ Jobup: Found ${jobupResult.jobs.length} jobs`);
    } else {
      console.error('❌ Jobup scraping failed:', jobupResult.error);
    }

    if (googleResult.success) {
      allJobs.push(...googleResult.jobs);
      console.log(`✅ Google Jobs: Found ${googleResult.jobs.length} jobs`);
    } else {
      console.error('❌ Google Jobs scraping failed:', googleResult.error);
    }

    // Remove duplicates across sources
    const uniqueJobs = this.deduplicateJobs(allJobs);
    console.log(`📊 Total unique jobs found: ${uniqueJobs.length}`);

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