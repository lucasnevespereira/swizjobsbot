import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

// Schema for validation
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().default('3000').transform(Number),
  DATABASE_URL: z.string(),
  TELEGRAM_BOT_TOKEN: z.string(),
  SERPAPI_API_KEY: z.string(),
  POSTGRES_USER: z.string().default('username'),
  POSTGRES_PASSWORD: z.string().default('password'),
  SCHEDULER_ENABLED: z.string().default('true').transform((val) => val === 'true'),
  SCHEDULER_CRON: z.string().default('0 */2 * * *'),
});

// Parse and validate
const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error('❌ Invalid environment variables:');
  console.error(parsedEnv.error.format());
  process.exit(1);
}

export const env = parsedEnv.data;
