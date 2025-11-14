'use strict';

/**
 * pharmacy-profile controller
 */

const { createCoreController } = require('@strapi/strapi').factories;

module.exports = createCoreController('api::pharmacy-profile.pharmacy-profile', ({ strapi }) => ({
  async create(ctx) {
    const user = ctx.state.user;
    if (!user) return ctx.unauthorized('You must be logged in');

    // เพิ่ม publishedAt เพื่อ force publish
    if (ctx.request.body.data) {
      ctx.request.body.data.publishedAt = new Date().toISOString();
    }

    const result = await super.create(ctx);

    // หลังสร้างเสร็จ ให้อัพเดท drug-store ให้ link กับ pharmacy-profile นี้
    if (result.data && ctx.request.body.data?.drug_stores) {
      const profileId = result.data.id;
      const storeIds = Array.isArray(ctx.request.body.data.drug_stores) 
        ? ctx.request.body.data.drug_stores 
        : [ctx.request.body.data.drug_stores];

      for (const storeId of storeIds) {
        try {
          // หา drug-store
          let store;
          const numericId = parseInt(storeId);
          if (!isNaN(numericId) && numericId > 0) {
            store = await strapi.entityService.findOne('api::drug-store.drug-store', numericId, {
              populate: ['pharmacy_profiles']
            });
          } else {
            const stores = await strapi.entityService.findMany('api::drug-store.drug-store', {
              filters: { documentId: storeId },
              populate: ['pharmacy_profiles'],
              limit: 1
            });
            store = stores?.[0];
          }

          if (store) {
            // เพิ่ม pharmacy-profile ใหม่เข้าไปใน drug-store
            const existingProfileIds = store.pharmacy_profiles?.map(p => p.id) || [];
            if (!existingProfileIds.includes(profileId)) {
              await strapi.entityService.update('api::drug-store.drug-store', store.id, {
                data: {
                  pharmacy_profiles: [...existingProfileIds, profileId],
                  publishedAt: new Date().toISOString()
                }
              });
            }
          }
        } catch (err) {
          console.error('Error linking pharmacy profile to store:', err);
        }
      }
    }

    return result;
  }
}));
