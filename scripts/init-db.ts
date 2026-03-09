import { initDb, runMigrations, getDb } from '../lib/db';
import { seedDatabase } from '../lib/db/seeds';

async function main() {
  console.log('Initializing database...');
  
  try {
    // Initialize schema
    initDb();
    console.log('✓ Database schema initialized');
    
    // Run migrations
    runMigrations();
    console.log('✓ Migrations completed');
    
    // Seed data
    await seedDatabase();
    console.log('✓ Database seeded');
    
    console.log('\nDatabase initialization complete!');
    process.exit(0);
  } catch (error) {
    console.error('Database initialization failed:', error);
    process.exit(1);
  }
}

main();
