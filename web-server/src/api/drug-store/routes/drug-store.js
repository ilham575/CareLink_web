'use strict';

const { createCoreRouter } = require('@strapi/strapi').factories;

module.exports = createCoreRouter('api::drug-store.drug-store', {
  config: {
    create: {
      policies: ['global::is-admin'],   // ใช้ policy ที่คุณสร้างเอง
    },
    update: {
      policies: ['global::is-admin'],
    },
    delete: {
      policies: ['global::is-admin'],
    },
  },
});
