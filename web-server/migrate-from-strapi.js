#!/usr/bin/env node
/**
 * Strapi database migration via internal connection
 * Runs from within Strapi's context where the database connection is already configured
 */

async function migrate() {
  console.log('🔧 Starting Strapi database migration...');
  
  try {
    // Import knex configuration
    const knex = require('knex');
    const path = require('path');
    
    // Use the Strapi database configuration
    const strapiConfig = require('./config/database')({ env: (key, defaultVal) => process.env[key] || defaultVal });
    
    // Create knex instance with Strapi config
    const db = knex(strapiConfig.connection);
    
    console.log('✅ Connected to database via Strapi config');
    
    // Check if column exists
    const hasColumn = await db.schema.hasColumn('drug_stores', 'admin_profile_id');
    
    if (hasColumn) {
      console.log('ℹ️  Column admin_profile_id already exists');
      await db.destroy();
      return;
    }
    
    // Add the column and foreign key
    console.log('📝 Adding admin_profile_id column to drug_stores...');
    await db.schema.table('drug_stores', (table) => {
      table.integer('admin_profile_id').unsigned().nullable();
      table.foreign('admin_profile_id')
        .references('id')
        .inTable('admin_profiles')
        .onDelete('SET NULL')
        .onUpdate('CASCADE');
    });
    
    console.log('✅ Migration completed successfully!');
    await db.destroy();
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

migrate();
