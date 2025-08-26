'use strict';

/**
 * staff-profile controller
 */

const { createCoreController } = require('@strapi/strapi').factories;

module.exports = createCoreController('api::staff-profile.staff-profile', ({ strapi }) => ({
  async findOne(ctx) {
    const { id } = ctx.params;

    // ถ้า id เป็นตัวเลข → ใช้ default
    if (!isNaN(parseInt(id))) {
      return await strapi.entityService.findOne('api::staff-profile.staff-profile', id, {
        populate: '*'
      });
    }

    // ถ้าไม่ใช่ตัวเลข → หา documentId แทน
    const result = await strapi.entityService.findMany('api::staff-profile.staff-profile', {
      filters: { documentId: id },
      populate: '*',
      limit: 1,
    });

    const entity = result[0];
    if (!entity) return ctx.notFound('Staff not found');
    return { data: entity };
  },
}));

