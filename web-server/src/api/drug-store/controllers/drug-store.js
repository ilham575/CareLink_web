'use strict';

const { createCoreController } = require('@strapi/strapi').factories;

module.exports = createCoreController('api::drug-store.drug-store', ({ strapi }) => ({

  async find(ctx) {
    const user = ctx.state.user;
    console.log('🔍 Current User:', user?.id, user?.username);

    // ปิด pharmacy filter
    return await super.find(ctx);
  },

  async findOne(ctx) {
    const { id } = ctx.params;
    let entity;
    const numericId = parseInt(id);

    if (!isNaN(numericId) && numericId > 0) {
      entity = await strapi.entityService.findOne('api::drug-store.drug-store', numericId, {
        populate: '*',
      });
    } else {
      const stores = await strapi.entityService.findMany('api::drug-store.drug-store', {
        filters: { documentId: id },
        populate: '*',
        limit: 1
      });
      entity = stores?.[0];
    }

    if (!entity) return ctx.notFound('Not Found');

    const sanitized = await this.sanitizeOutput(entity, ctx);
    return this.transformResponse(sanitized);
  },

  async create(ctx) {
    const user = ctx.state.user;
    console.log("🟡 ctx.state.user in create:", user);
    if (!user) return ctx.unauthorized('You must be logged in');

    const adminProfiles = await strapi.entityService.findMany('api::admin-profile.admin-profile', {
      filters: { users_permissions_user: user.id },
      limit: 1,
    });
    if (!adminProfiles || adminProfiles.length === 0) {
      return ctx.forbidden('No admin_profile found for this user');
    }
    const adminProfileId = adminProfiles[0].id;

    if (typeof ctx.request.body.data === 'string') {
      ctx.request.body.data = JSON.parse(ctx.request.body.data);
    }
    ctx.request.body.data = ctx.request.body.data || {};

    // Debug: log body before setting admin_profile
    console.log("🟠 Body before setting admin_profile:", JSON.stringify(ctx.request.body.data));

    // ลบ field เดิมออกก่อน set ใหม่
    delete ctx.request.body.data.admin_profile;
    ctx.request.body.data.admin_profile = adminProfileId;
    console.log("🟢 Set admin_profile in create:", ctx.request.body.data.admin_profile, typeof ctx.request.body.data.admin_profile);

    // ✅ force publish
    ctx.request.body.data.publishedAt = new Date().toISOString();

    // Debug: log body before create
    console.log("🔵 Body before create:", JSON.stringify(ctx.request.body.data));

    // สร้าง drug-store โดยไม่แนบ relation
    const entity = await strapi.entityService.create('api::drug-store.drug-store', {
      data: {
        ...ctx.request.body.data
        // ไม่ต้องแนบ admin_profile
      },
    });

    // Force update relation ด้วย raw SQL (Knex)
    await strapi.db.connection('drug_stores')
      .where({ id: entity.id })
      .update({ admin_profile_id: adminProfileId });

    // Sync ORM ด้วย entityService.update (แนบ relation ซ้ำ)
    await strapi.entityService.update('api::drug-store.drug-store', entity.id, {
      data: { admin_profile: adminProfileId }
    });

    // ดึง entity ใหม่ (populate relation)
    const updated = await strapi.entityService.findOne('api::drug-store.drug-store', entity.id, { populate: '*' });

    const sanitized = await this.sanitizeOutput(updated, ctx);
    return this.transformResponse(sanitized);
  },

  async update(ctx) {
    const { id } = ctx.params;
    const user = ctx.state.user;
    if (!user) return ctx.unauthorized('You must be logged in');

    let store;
    const numericId = parseInt(id);
    if (!isNaN(numericId) && numericId > 0) {
      store = await strapi.entityService.findOne('api::drug-store.drug-store', numericId);
    } else {
      const stores = await strapi.entityService.findMany('api::drug-store.drug-store', {
        filters: { documentId: id },
        limit: 1
      });
      store = stores?.[0];
    }

    if (!store) return ctx.notFound('Store not found');

    const userRole = user.role?.type;

    if (userRole === 'admin' || userRole === 'pharmacy') {
      const updateData = ctx.request.body.data || {};
      updateData.publishedAt = new Date().toISOString();

      const updated = await strapi.entityService.update('api::drug-store.drug-store', store.id, {
        data: updateData,
      });

      const sanitized = await this.sanitizeOutput(updated, ctx);
      return this.transformResponse(sanitized);
    }

    return ctx.forbidden('Insufficient permissions to update store');
  },

  async delete(ctx) {
    const { id } = ctx.params;
    const user = ctx.state.user;
    if (!user) return ctx.unauthorized('You must be logged in');

    let store;
    const numericId = parseInt(id);
    if (!isNaN(numericId) && numericId > 0) {
      store = await strapi.entityService.findOne('api::drug-store.drug-store', numericId, { populate: '*' });
    } else {
      const stores = await strapi.entityService.findMany('api::drug-store.drug-store', {
        filters: { documentId: id },
        populate: '*',
        limit: 1
      });
      store = stores?.[0];
    }

    if (!store) return ctx.notFound('Store not found');

    // ลบข้อมูลที่เกี่ยวข้องกับร้านยานี้
    // 1. ลบ pharmacy-profiles ที่ผูกกับร้านนี้
    if (Array.isArray(store.pharmacy_profiles)) {
      for (const profile of store.pharmacy_profiles) {
        await strapi.entityService.delete('api::pharmacy-profile.pharmacy-profile', profile.id);
      }
    }
    // 2. ลบ staff-profiles ที่ผูกกับร้านนี้
    if (Array.isArray(store.staff_profiles)) {
      for (const staff of store.staff_profiles) {
        await strapi.entityService.delete('api::staff-profile.staff-profile', staff.id);
      }
    }
    // 3. ลบ customer-profiles ที่ผูกกับร้านนี้
    if (Array.isArray(store.customer_profiles)) {
      for (const customer of store.customer_profiles) {
        await strapi.entityService.delete('api::customer-profile.customer-profile', customer.id);
      }
    }
    // 4. ลบไฟล์รูปภาพ (ถ้ามี)
    const photoFields = ['photo_front', 'photo_in', 'photo_staff'];
    for (const field of photoFields) {
      const photo = store[field];
      if (photo && photo.id) {
        await strapi.plugins['upload'].services.upload.remove(photo);
      }
    }
    // 5. ลบ drug-store (ร้านยา) ตัวเอง
    await strapi.entityService.delete('api::drug-store.drug-store', store.id);

    return ctx.send({ message: 'Deleted store and all related data.' });
  }

}));
