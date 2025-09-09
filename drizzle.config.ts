import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/database/schema.ts',
  out: './migrations',
  driver: 'pg',
  dbCredentials: {
    connectionString: process.env.DATABASE_URL!,
  }
});
