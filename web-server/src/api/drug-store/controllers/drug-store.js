'use strict';

const { createCoreController } = require('@strapi/strapi').factories;

module.exports = createCoreController('api::drug-store.drug-store', ({ strapi }) => ({
  async findOne(ctx) {
    const { id } = ctx.params;

    const entity = await strapi.entityService.findOne('api::drug-store.drug-store', Number(id), {
      populate: '*', // เพิ่ม media fields ที่คุณต้องการ
    });

    if (!entity) {
      return ctx.notFound('Not Found');
    }

    const sanitized = await this.sanitizeOutput(entity, ctx);
    return this.transformResponse(sanitized);
  },
}));

