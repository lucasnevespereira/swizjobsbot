export interface JobMatch {
  id: string;
  title: string;
  company: string;
  location: string;
  url: string;
  description?: string;
  postedDate: Date;
  source: 'jobup' | 'google';
}

export interface UserConfig {
  chatId: string;
  keywords: string[];
  locations: string[];
  maxAgeDays: number;
  active: boolean;
  language: 'fr' | 'en';
}

export interface TelegramMessage {
  chatId: string;
  text: string;
  parseMode?: 'HTML' | 'Markdown';
}

export interface ScrapingResult {
  jobs: JobMatch[];
  success: boolean;
  error?: string;
}

export const SWISS_CANTONS = [
  'Aargau', 'Appenzell Ausserrhoden', 'Appenzell Innerrhoden', 'Basel-Landschaft',
  'Basel-Stadt', 'Bern', 'Fribourg', 'Geneva', 'Glarus', 'Grisons', 'Jura',
  'Lucerne', 'Neuchâtel', 'Nidwalden', 'Obwalden', 'Schaffhausen', 'Schwyz',
  'Solothurn', 'St. Gallen', 'Thurgau', 'Ticino', 'Uri', 'Valais', 'Vaud',
  'Zug', 'Zurich'
] as const;

export type SwissCanton = typeof SWISS_CANTONS[number];
