import { initDb, runMigrations, closeDb } from '../lib/db';

async function main() {
  console.log('Running database migrations...\n');
  
  try {
    // Initialize schema
    initDb();
    console.log('✓ Database schema initialized');
    
    // Run migrations
    runMigrations();
    console.log('✓ Migrations completed');
    
    console.log('\nDatabase is up to date!');
    closeDb();
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    closeDb();
    process.exit(1);
  }
}

main();
