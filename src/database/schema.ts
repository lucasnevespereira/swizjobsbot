import { pgTable, serial, text, timestamp, boolean, integer, jsonb } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  telegramChatId: text('telegram_chat_id').notNull().unique(),
  language: text('language').notNull().default('fr'),
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow()
});

export const jobSearches = pgTable('job_searches', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  keywords: jsonb('keywords').notNull().$type<string[]>(),
  locations: jsonb('locations').notNull().$type<string[]>(),
  maxAgeDays: integer('max_age_days').notNull().default(7),
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow()
});

export const jobPostings = pgTable('job_postings', {
  id: serial('id').primaryKey(),
  externalId: text('external_id').notNull(),
  title: text('title').notNull(),
  company: text('company').notNull(),
  location: text('location').notNull(),
  url: text('url').notNull(),
  description: text('description'),
  postedDate: timestamp('posted_date').notNull(),
  source: text('source').notNull(), // 'jobup', 'google'
  createdAt: timestamp('created_at').notNull().defaultNow()
});

export const userNotifications = pgTable('user_notifications', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  jobPostingId: integer('job_posting_id').notNull().references(() => jobPostings.id, { onDelete: 'cascade' }),
  sentAt: timestamp('sent_at').notNull().defaultNow()
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type JobSearch = typeof jobSearches.$inferSelect;
export type NewJobSearch = typeof jobSearches.$inferInsert;
export type JobPosting = typeof jobPostings.$inferSelect;
export type NewJobPosting = typeof jobPostings.$inferInsert;
export type UserNotification = typeof userNotifications.$inferSelect;
export type NewUserNotification = typeof userNotifications.$inferInsert;
