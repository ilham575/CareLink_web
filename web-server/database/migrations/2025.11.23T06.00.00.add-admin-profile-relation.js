'use strict';

/**
 * Add admin_profile relation to drug_stores table
 */

async function up(knex) {
  console.log('🔧 Adding admin_profile relation to drug_stores...');

  // [เพิ่มส่วนนี้] 1. เช็คก่อนว่ามีตาราง drug_stores หรือยัง?
  // ถ้า Database ว่างเปล่า (เพิ่งเริ่ม) ตารางจะยังไม่มี -> ให้ข้ามไปเลย ไม่ต้อง Alter
  const hasTable = await knex.schema.hasTable('drug_stores');
  
  if (!hasTable) {
    console.log('⚠️ Table "drug_stores" does not exist yet. Skipping migration.');
    return; // จบการทำงานฟังก์ชันนี้ทันที
  }
  
  // 2. ถ้ามีตารางแล้ว ค่อยเช็คว่ามีคอลัมน์ไหม (Logic เดิม)
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
  
  // [เพิ่มส่วนนี้เช่นกัน] เช็คว่ามีตารางไหมก่อนลบ เพื่อกัน Error
  const hasTable = await knex.schema.hasTable('drug_stores');
  if (!hasTable) return;

  const hasColumn = await knex.schema.hasColumn('drug_stores', 'admin_profile_id');
  
  if (hasColumn) {
    await knex.schema.table('drug_stores', (table) => {
      // ต้อง Drop FK ก่อน Drop Column เสมอ
      table.dropForeign(['admin_profile_id']); 
      table.dropColumn('admin_profile_id');
    });
    
    console.log('✅ admin_profile_id column removed from drug_stores');
  }
}

module.exports = { up, down };