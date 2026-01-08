"use strict";

/**
 * notification controller
 */

const { createCoreController } = require('@strapi/strapi').factories;

module.exports = createCoreController('api::notification.notification', ({ strapi }) => ({
  async create(ctx) {
    console.log('[Controller] Creating notification:', {
      body: ctx.request.body,
      user: ctx.state.user?.id
    });
    
    // call the default core action
    const response = await super.create(ctx);
    
    console.log('[Controller] Notification created successfully:', {
      id: response.data?.id,
      documentId: response.data?.documentId,
      type: response.data?.type
    });

    return response;
  },

  async find(ctx) {
    // call the default core action
    const response = await super.find(ctx);

    if (response?.data) {
      response.data = Array.isArray(response.data)
        ? response.data.map(item => ({
            ...item,
            staff_work_status: {
              received: item.staff_work_status?.received ?? false,
              prepared: item.staff_work_status?.prepared ?? false,
              received_at: item.staff_work_status?.received_at ?? null,
              prepared_at: item.staff_work_status?.prepared_at ?? null,
              prepared_note: item.staff_work_status?.prepared_note ?? '',
              outOfStock: item.staff_work_status?.outOfStock ?? [],
              cancelled: item.staff_work_status?.cancelled ?? false,
              cancelled_at: item.staff_work_status?.cancelled_at ?? null,
              cancelled_note: item.staff_work_status?.cancelled_note ?? '',
              batches_selected: item.staff_work_status?.batches_selected || {}
            }
          }))
        : {
            ...response.data,
            staff_work_status: {
              received: response.data?.staff_work_status?.received ?? false,
              prepared: response.data?.staff_work_status?.prepared ?? false,
              received_at: response.data?.staff_work_status?.received_at ?? null,
              prepared_at: response.data?.staff_work_status?.prepared_at ?? null,
              prepared_note: response.data?.staff_work_status?.prepared_note ?? '',
              outOfStock: response.data?.staff_work_status?.outOfStock ?? [],
              cancelled: response.data?.staff_work_status?.cancelled ?? false,
              cancelled_at: response.data?.staff_work_status?.cancelled_at ?? null,
              cancelled_note: response.data?.staff_work_status?.cancelled_note ?? '',
              batches_selected: response.data?.staff_work_status?.batches_selected || {}
            }
          };
    }

    return response;
  },

  async findOne(ctx) {
    const response = await super.findOne(ctx);

    if (response?.data) {
      response.data = {
        ...response.data,
        staff_work_status: {
          received: response.data?.staff_work_status?.received ?? false,
          prepared: response.data?.staff_work_status?.prepared ?? false,
          received_at: response.data?.staff_work_status?.received_at ?? null,
          prepared_at: response.data?.staff_work_status?.prepared_at ?? null,
          prepared_note: response.data?.staff_work_status?.prepared_note ?? '',
          outOfStock: response.data?.staff_work_status?.outOfStock ?? [],
          cancelled: response.data?.staff_work_status?.cancelled ?? false,
          cancelled_at: response.data?.staff_work_status?.cancelled_at ?? null,
          cancelled_note: response.data?.staff_work_status?.cancelled_note ?? '',
          batches_selected: response.data?.staff_work_status?.batches_selected || {}
        }
      };
    }

    return response;
  }
}));