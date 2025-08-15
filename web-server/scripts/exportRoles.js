'use strict';
const fs = require('fs');
const path = require('path');

module.exports = async ({ strapi }) => {
  const roles = await strapi.db.query('plugin::users-permissions.role').findMany();
  fs.writeFileSync(path.resolve(__dirname, 'roles-A.json'), JSON.stringify(roles, null, 2));
  console.log(`✅ Exported ${roles.length} roles`);
};
