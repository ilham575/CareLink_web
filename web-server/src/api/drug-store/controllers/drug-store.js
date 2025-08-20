'use strict';

const { createCoreController } = require('@strapi/strapi').factories;

module.exports = createCoreController('api::drug-store.drug-store', ({ strapi }) => ({
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