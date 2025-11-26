'use strict';
const importRoles = require('../scripts/importRoles');

module.exports = {
  register() {},
  async bootstrap({ strapi }) {
    // Import roles first
    await importRoles({ strapi });
    
    // Run database migrations
    await runDatabaseMigrations({ strapi });
  },
};

/**
 * Run database migrations on Strapi bootstrap
 * This adds any missing columns to the database
 */
async function runDatabaseMigrations({ strapi }) {
  console.log('🔧 [MIGRATION] Starting database migrations...');
  
  try {
    const knex = strapi.db.connection;
    
    // Check if admin_profile_id column exists in drug_stores
    const hasColumn = await knex.schema.hasColumn('drug_stores', 'admin_profile_id');
    
    if (!hasColumn) {
      console.log('📝 [MIGRATION] Adding admin_profile_id column to drug_stores table...');
      
      await knex.schema.table('drug_stores', (table) => {
        table.integer('admin_profile_id').nullable();
      });
      
      console.log('✅ [MIGRATION] Column admin_profile_id added successfully');
      
      // Try to add foreign key if possible
      try {
        const hasForeignKey = await knex.raw(`
          SELECT 1 FROM information_schema.table_constraints 
          WHERE table_name = 'drug_stores' 
          AND constraint_name = 'fk_drug_stores_admin_profile'
        `);
        
        if (!hasForeignKey.rows || hasForeignKey.rows.length === 0) {
          await knex.schema.table('drug_stores', (table) => {
            table.foreign('admin_profile_id')
              .references('id')
              .inTable('admin_profiles')
              .onDelete('SET NULL')
              .onUpdate('CASCADE');
          });
          console.log('✅ [MIGRATION] Foreign key constraint added successfully');
        }
      } catch (fkError) {
        console.warn('⚠️  [MIGRATION] Could not add foreign key:', fkError.message);
      }
    } else {
      console.log('ℹ️  [MIGRATION] Column admin_profile_id already exists - skipping');
    }
    
    console.log('✅ [MIGRATION] Database migrations completed');
  } catch (error) {
    console.error('❌ [MIGRATION] Migration failed:', error.message);
    // Don't throw - allow Strapi to continue even if migration fails
  }
}
