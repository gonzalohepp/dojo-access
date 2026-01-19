require('dotenv').config({ path: '../.env.local' });
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

async function run() {
    const connectionString = process.env.NEXT_PUBLIC_SUPABASE_URL
        ? process.env.NEXT_PUBLIC_SUPABASE_URL.replace('.supabase.co', '.supabase.co:5432').replace('https://', 'postgres://postgres:' + (process.env.SUPABASE_SERVICE_ROLE_KEY || '') + '@') // This is a specific guess, but usually we need the DB URL.
        : process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;

    console.log('Connecting to DB...');

    // NOTE: The user environment often has POSTGRES_URL or DATABASE_URL.
    // I will check .env.local content first or try to construct it.
    // Actually, I should just read the file content of fix_dashboard_stats.sql and execute it.

    // Let's assume the user has a valid connection string in env.

    const client = new Client({
        connectionString: process.env.SUPABASE_DB_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();
        const sql = fs.readFileSync('../fix_dashboard_stats.sql', 'utf8');
        await client.query(sql);
        console.log('Successfully recreated dashboard_stats view.');
    } catch (err) {
        console.error('Error executing SQL:', err);
    } finally {
        await client.end();
    }
}

run();
