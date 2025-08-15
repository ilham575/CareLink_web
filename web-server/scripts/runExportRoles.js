'use strict';

const { createStrapi } = require('@strapi/strapi');
const exportRoles = require('./exportRoles');

const run = async () => {
  const strapi = await createStrapi();
  await strapi.load();
  await strapi.start();

  await exportRoles({ strapi });

  await strapi.destroy();
};

run().catch((err) => {
  console.error('❌ Export failed:', err);
});
