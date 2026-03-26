'use strict';

/**
 * Add take_until_finished column to medication_schedules table.
 */

async function up(knex) {
  console.log('🔧 Adding take_until_finished to medication_schedules...');

  const hasTable = await knex.schema.hasTable('medication_schedules');
  if (!hasTable) {
    console.log('⚠️ Table "medication_schedules" does not exist yet. Skipping.');
    return;
  }

  const hasColumn = await knex.schema.hasColumn('medication_schedules', 'take_until_finished');
  if (!hasColumn) {
    await knex.schema.table('medication_schedules', (table) => {
      table.boolean('take_until_finished').defaultTo(false);
    });
    console.log('✅ take_until_finished column added to medication_schedules');
  } else {
    console.log('ℹ️ take_until_finished already exists in medication_schedules');
  }
}

async function down(knex) {
  console.log('🔧 Removing take_until_finished from medication_schedules...');

  const hasTable = await knex.schema.hasTable('medication_schedules');
  if (!hasTable) return;

  const hasColumn = await knex.schema.hasColumn('medication_schedules', 'take_until_finished');
  if (hasColumn) {
    await knex.schema.table('medication_schedules', (table) => {
      table.dropColumn('take_until_finished');
    });
    console.log('✅ take_until_finished removed from medication_schedules');
  }
}

module.exports = { up, down };
