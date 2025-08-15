'use strict';

const { createStrapi } = require('@strapi/strapi');
const importRoles = require('./importRoles');

const run = async () => {
  const strapi = await createStrapi();
  await strapi.load();
  await strapi.start();

  await importRoles({ strapi });

  await strapi.destroy();
};

run().catch((err) => {
  console.error('❌ Import failed:', err);
});
