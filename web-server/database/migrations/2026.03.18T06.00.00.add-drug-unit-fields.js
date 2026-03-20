'use strict';

/**
 * Add drug_unit and drug_unit_custom columns to drugs table,
 * and dosage_unit column to medication_schedules table.
 */

async function up(knex) {
  console.log('🔧 Adding drug unit fields...');

  // --- drugs table ---
  const hasDrugs = await knex.schema.hasTable('drugs');
  if (hasDrugs) {
    const hasDrugUnit = await knex.schema.hasColumn('drugs', 'drug_unit');
    if (!hasDrugUnit) {
      await knex.schema.table('drugs', (table) => {
        table.string('drug_unit').defaultTo('tablet').nullable();
      });
      console.log('✅ drug_unit column added to drugs');
    } else {
      console.log('ℹ️ drug_unit column already exists in drugs');
    }

    const hasDrugUnitCustom = await knex.schema.hasColumn('drugs', 'drug_unit_custom');
    if (!hasDrugUnitCustom) {
      await knex.schema.table('drugs', (table) => {
        table.string('drug_unit_custom').nullable();
      });
      console.log('✅ drug_unit_custom column added to drugs');
    } else {
      console.log('ℹ️ drug_unit_custom column already exists in drugs');
    }
  } else {
    console.log('⚠️ Table "drugs" does not exist yet. Skipping.');
  }

  // --- medication_schedules table ---
  const hasMedSchedules = await knex.schema.hasTable('medication_schedules');
  if (hasMedSchedules) {
    const hasDosageUnit = await knex.schema.hasColumn('medication_schedules', 'dosage_unit');
    if (!hasDosageUnit) {
      await knex.schema.table('medication_schedules', (table) => {
        table.string('dosage_unit').nullable();
      });
      console.log('✅ dosage_unit column added to medication_schedules');
    } else {
      console.log('ℹ️ dosage_unit column already exists in medication_schedules');
    }
  } else {
    console.log('⚠️ Table "medication_schedules" does not exist yet. Skipping.');
  }
}

async function down(knex) {
  console.log('🔧 Removing drug unit fields...');

  const hasDrugs = await knex.schema.hasTable('drugs');
  if (hasDrugs) {
    const hasDrugUnit = await knex.schema.hasColumn('drugs', 'drug_unit');
    if (hasDrugUnit) {
      await knex.schema.table('drugs', (table) => {
        table.dropColumn('drug_unit');
      });
    }
    const hasDrugUnitCustom = await knex.schema.hasColumn('drugs', 'drug_unit_custom');
    if (hasDrugUnitCustom) {
      await knex.schema.table('drugs', (table) => {
        table.dropColumn('drug_unit_custom');
      });
    }
  }

  const hasMedSchedules = await knex.schema.hasTable('medication_schedules');
  if (hasMedSchedules) {
    const hasDosageUnit = await knex.schema.hasColumn('medication_schedules', 'dosage_unit');
    if (hasDosageUnit) {
      await knex.schema.table('medication_schedules', (table) => {
        table.dropColumn('dosage_unit');
      });
    }
  }
}

module.exports = { up, down };
