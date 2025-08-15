'use strict';
const fs = require('fs');
const path = require('path');

module.exports = async ({ strapi }) => {
  const roles = await strapi.db.query('plugin::users-permissions.role').findMany({
    populate: ['permissions'],
  });

  const filePath = path.resolve(__dirname, 'roles-A.json');
  fs.writeFileSync(filePath, JSON.stringify(roles, null, 2));

  console.log(`✅ Exported ${roles.length} roles with permissions to roles-A.json`);
};
