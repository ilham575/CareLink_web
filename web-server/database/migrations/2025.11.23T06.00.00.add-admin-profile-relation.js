'use strict';

/**
 * Add admin_profile relation to drug_stores table
 */

async function up(knex) {
  console.log('🔧 Adding admin_profile relation to drug_stores...');
  
  // Check if the column already exists
  const hasColumn = await knex.schema.hasColumn('drug_stores', 'admin_profile_id');
  
  if (!hasColumn) {
    await knex.schema.table('drug_stores', (table) => {
      // Add foreign key column
      table.integer('admin_profile_id').unsigned().nullable();
      
      // Add foreign key constraint
      table.foreign('admin_profile_id')
        .references('id')
        .inTable('admin_profiles')
        .onDelete('SET NULL')
        .onUpdate('CASCADE');
    });
    
    console.log('✅ admin_profile_id column added to drug_stores');
  } else {
    console.log('ℹ️ admin_profile_id column already exists');
  }
}

async function down(knex) {
  console.log('🔧 Removing admin_profile relation from drug_stores...');
  
  const hasColumn = await knex.schema.hasColumn('drug_stores', 'admin_profile_id');
  
  if (hasColumn) {
    await knex.schema.table('drug_stores', (table) => {
      table.dropForeign(['admin_profile_id']);
      table.dropColumn('admin_profile_id');
    });
    
    console.log('✅ admin_profile_id column removed from drug_stores');
  }
}

module.exports = { up, down };