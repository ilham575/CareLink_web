"use strict";

/**
 * notification controller
 */

const { createCoreController } = require('@strapi/strapi').factories;

module.exports = createCoreController('api::notification.notification', ({ strapi }) => ({
  async find(ctx) {
    // call the default core action
    const response = await super.find(ctx);

    if (response?.data) {
      response.data = Array.isArray(response.data)
        ? response.data.map(item => ({
            ...item,
            staff_work_status: item.staff_work_status || {
              received: false,
              prepared: false,
              received_at: null,
              prepared_at: null,
              prepared_note: '',
              outOfStock: [],
              cancelled: false,
              cancelled_at: null,
              cancelled_note: ''
            }
          }))
        : {
            ...response.data,
            staff_work_status: response.data?.staff_work_status || {
              received: false,
              prepared: false,
              received_at: null,
              prepared_at: null,
              prepared_note: '',
              outOfStock: [],
              cancelled: false,
              cancelled_at: null,
              cancelled_note: ''
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
        staff_work_status: response.data.staff_work_status || {
          received: false,
          prepared: false,
          received_at: null,
          prepared_at: null,
          prepared_note: '',
          outOfStock: [],
          cancelled: false,
          cancelled_at: null,
          cancelled_note: ''
        }
      };
    }

    return response;
  }
}));