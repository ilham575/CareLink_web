'use strict';

const { createCoreController } = require('@strapi/strapi').factories;

module.exports = createCoreController('api::drug-store.drug-store', ({ strapi }) => ({
  async find(ctx) {
    const user = ctx.state.user;
    console.log('🔍 Current User:', user?.id, user?.username);

    // ปิด pharmacy filter ชั่วคราว
    if (false && user) {  // เปลี่ยน false เป็น true เมื่อแก้ไขข้อมูลเสร็จ
      const pharmacyProfiles = await strapi.entityService.findMany('api::pharmacy-profile.pharmacy-profile', {
        filters: { users_permissions_user: user.id }
      });
      
      console.log('🏥 Found Pharmacy Profiles:', pharmacyProfiles);
      
      if (pharmacyProfiles && pharmacyProfiles.length > 0) {
        const profileIds = pharmacyProfiles.map(p => p.id);
        console.log('🔍 Profile IDs to filter:', profileIds);
        
        // Debug: ดูว่ามี drug store ไหนที่มี pharmacy_profiles บ้าง
        const allStores = await strapi.entityService.findMany('api::drug-store.drug-store', {
          populate: ['pharmacy_profiles']
        });
        
        console.log('🏪 All Drug Stores with relations:');
        allStores.forEach(store => {
          console.log(`Store ${store.id} (${store.name_th}):`, {
            pharmacy_profiles: store.pharmacy_profiles?.map(p => ({
              id: p.id,
              license: p.pharmacy_license_no
            })) || []
          });
        });
        
        ctx.query.filters = {
          ...ctx.query.filters,
          pharmacy_profiles: { id: { $in: profileIds } }
        };
        
        console.log('PHARMACIST :: Final filter:', JSON.stringify(ctx.query.filters, null, 2));
        
        const result = await super.find(ctx);
        console.log('🎯 Filtered Result:', {
          count: result.data?.length,
          stores: result.data?.map(s => ({ id: s.id, name: s.name_th }))
        });
        
        return result;
      }
    }
    
    return await super.find(ctx);
  },
  async findOne(ctx) {
    const { id } = ctx.params;

    const entity = await strapi.entityService.findOne('api::drug-store.drug-store', Number(id), {
      populate: '*', // ดึง relation/media ทุก field
    });

    if (!entity) {
      return ctx.notFound('Not Found');
    }

    const sanitized = await this.sanitizeOutput(entity, ctx);
    return this.transformResponse(sanitized);
  },

  async create(ctx) {
    const user = ctx.state.user;
    if (!user) {
      return ctx.unauthorized('You must be logged in');
    }

    // หา admin_profile ที่เชื่อมกับ user นี้
    const adminProfiles = await strapi.entityService.findMany('api::admin-profile.admin-profile', {
      filters: { users_permissions_user: user.id },
      limit: 1,
    });
    if (!adminProfiles || adminProfiles.length === 0) {
      return ctx.forbidden('No admin_profile found for this user');
    }
    const adminProfileId = adminProfiles[0].id;

    // แก้ไขให้ robust รองรับกรณี body.data เป็น string (กรณี multipart/form-data)
    if (typeof ctx.request.body.data === 'string') {
      ctx.request.body.data = JSON.parse(ctx.request.body.data);
    }
    ctx.request.body.data = ctx.request.body.data || {};
    ctx.request.body.data.admin_profile = adminProfileId; // ผูก profile อัตโนมัติ

    // เรียก core create (รองรับทั้งไฟล์และ JSON)
    return await super.create(ctx);
  },
}));