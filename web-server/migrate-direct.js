#!/usr/bin/env node
/**
 * Direct database migration script for Cloud Run
 * This adds the admin_profile_id column to drug_stores table
 */

const { Pool } = require('pg');

// Get database config from environment  
const dbConfig = {
  user: process.env.DATABASE_USERNAME || 'postgres',
  password: process.env.DATABASE_PASSWORD,
  database: process.env.DATABASE_NAME || 'carelink_db',
  // Cloud SQL Unix socket path - pg module handles it automatically
  host: '/cloudsql/carelink-web:asia-southeast1:carelink-db',
};

console.log('🔧 Starting database migration...');
console.log(`📍 Connecting to database: ${dbConfig.database}`);

const pool = new Pool(dbConfig);

async function runMigration() {
  let client;
  try {
    console.log('⏳ Attempting to connect...');
    client = await pool.connect();
    console.log('✅ Connected to database');
    
    // Check if column already exists
    console.log('🔍 Checking if admin_profile_id column exists...');
    const checkResult = await client.query(`
      SELECT EXISTS(
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'drug_stores' AND column_name = 'admin_profile_id'
      )
    `);
    
    if (checkResult.rows[0].exists) {
      console.log('ℹ️  Column admin_profile_id already exists - skipping migration');
      return;
    }
    
    console.log('📝 Column does not exist - proceeding with migration');
    
    // Add the column  (PostgreSQL doesn't have UNSIGNED, just use INTEGER)
    console.log('📝 Adding admin_profile_id column to drug_stores table...');
    await client.query(`ALTER TABLE drug_stores ADD COLUMN admin_profile_id INTEGER`);
    console.log('✅ Column added successfully');
    
    // Try to add foreign key constraint, but don't fail if it doesn't work
    try {
      console.log('🔗 Adding foreign key constraint...');
      await client.query(`
        ALTER TABLE drug_stores 
        ADD CONSTRAINT fk_drug_stores_admin_profile
        FOREIGN KEY (admin_profile_id) 
        REFERENCES admin_profiles(id) 
        ON DELETE SET NULL 
        ON UPDATE CASCADE
      `);
      console.log('✅ Foreign key added successfully');
    } catch (constraintError) {
      console.warn('⚠️  Foreign key constraint failed (non-critical):', constraintError.message);
      // Continue anyway - column was added successfully
    }
    
    console.log('✅ Migration completed successfully!');
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    if (error.code) {
      console.error('   Error code:', error.code);
    }
    if (error.detail) {
      console.error('   Details:', error.detail);
    }
    throw error;
  } finally {
    if (client) {
      client.release();
    }
  }
}

// Run the migration
runMigration()
  .then(() => {
    console.log('🎉 Database migration finished');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Final error:', error.message);
    process.exit(1);
  })
  .finally(() => {
    pool.end();
  });
