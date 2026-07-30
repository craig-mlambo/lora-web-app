import postgres from 'postgres';
import { env } from '$env/dynamic/private';

/** @type {import('postgres').Sql | undefined} */
let database;

/**
 * Returns the server-only PostgreSQL client used for transactional business
 * workflows. Use Supabase's transaction-pooler connection string in production.
 */
export function getDb() {
	if (!env.SUPABASE_DB_URL) {
		throw new Error('SUPABASE_DB_URL is required for server-side database workflows.');
	}

	if (!database) {
		database = postgres(env.SUPABASE_DB_URL, {
			ssl: 'require',
			prepare: false,
			max: 5,
			idle_timeout: 20,
			connect_timeout: 15
		});
	}

	return database;
}
