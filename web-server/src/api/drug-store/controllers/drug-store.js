'use strict';

const { createCoreController } = require('@strapi/strapi').factories;

module.exports = createCoreController('api::drug-store.drug-store', ({ strapi }) => ({
  async find(ctx) {
    const user = ctx.state.user;

    if (user) {
      // -- PHARMACIST --
      const pharmacyProfiles = await strapi.entityService.findMany('api::pharmacy-profile.pharmacy-profile', {
        filters: { users_permissions_user: user.id }
      });
      if (pharmacyProfiles && pharmacyProfiles.length > 0) {
        const profileIds = pharmacyProfiles.map(p => p.id);
        ctx.query.filters = {
          ...ctx.query.filters,
          pharmacy_profiles: { id: { $in: profileIds } }
        };
        // >>> LOG เงื่อนไข filter สุดท้ายที่ใช้จริง
        console.log('PHARMACIST :: ctx.query.filters =', JSON.stringify(ctx.query.filters, null, 2));
        return await super.find(ctx);
      }

      // -- ADMIN --
      const adminProfiles = await strapi.entityService.findMany('api::admin-profile.admin-profile', {
        filters: { users_permissions_user: user.id },
        limit: 1,
      });
      if (adminProfiles && adminProfiles.length > 0) {
        const adminProfileId = adminProfiles[0].id;
        ctx.query.filters = {
          ...ctx.query.filters,
          admin_profile: adminProfileId
        };
        // >>> LOG เงื่อนไข filter สุดท้ายที่ใช้จริง
        console.log('ADMIN :: ctx.query.filters =', JSON.stringify(ctx.query.filters, null, 2));
        return await super.find(ctx);
      }

      // >>> LOG กรณีไม่ผ่าน profile
      console.log('NO PROFILE :: ctx.query.filters =', JSON.stringify(ctx.query.filters, null, 2));
      return this.transformResponse([]);
    }
    // guest: ใช้ core filter ได้เต็มที่
    console.log('GUEST :: ctx.query.filters =', JSON.stringify(ctx.query.filters, null, 2));
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