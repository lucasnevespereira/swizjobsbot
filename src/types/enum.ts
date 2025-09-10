export enum ENV {
  production = 'production',
  development = 'development',
}

export enum TIMEZONE {
  Zurich = 'Europe/Zurich'
}

export enum LOCALE {
  frCH = 'fr-CH',
}

export enum JOB_SOURCE {
  google = 'google',
}

export enum CRON_SCHEDULE  {
  every2Hours = '0 */2 * * *',
  every30Minutes = '*/30 * * * *',
  dailyAt2AM = '0 2 * * *',
}
