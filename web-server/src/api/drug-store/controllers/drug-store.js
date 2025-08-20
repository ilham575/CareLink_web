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

  async create(ctx) {
    const user = ctx.state.user;
    if (!user) {
      return ctx.unauthorized('You must be logged in to create a drug store.');
    }

    // กรณี user.role เป็น object หรือ id
    const roleId = typeof user.role === 'object' ? user.role.id : user.role;
    const userRole = await strapi.entityService.findOne('plugin::users-permissions.role', roleId, {});

    if (!userRole || userRole.type !== 'admin') {
      return ctx.forbidden('Only admin can create a drug store.');
    }

    ctx.request.body.data = ctx.request.body.data || {};
    ctx.request.body.data.owner = user.id;

    const response = await super.create(ctx);
    return response;
  }
}));

