'use strict';

const { createCoreRouter } = require('@strapi/strapi').factories;

module.exports = createCoreRouter('api::drug-store.drug-store', {
  config: {
    find: {
      policies: [],
    },
    findOne: {
      policies: [],
    },
    create: {
      policies: ['global::is-admin'],
    },
    update: {
      policies: [], // ให้ controller จัดการสิทธิ์เอง
    },
    delete: {
      policies: ['global::is-admin'],
    }
  }
});
