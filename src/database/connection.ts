import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema.js';

const connectionString = process.env.DATABASE_URL || 'postgresql://username:password@localhost:5432/swiss_job_bot';

console.log('🔌 Database connection string:', connectionString.replace(/password:[^@]+@/, 'password:***@'));

// Create postgres client
const client = postgres(connectionString);

// Create drizzle instance
export const db = drizzle(client, { schema });

export { client };