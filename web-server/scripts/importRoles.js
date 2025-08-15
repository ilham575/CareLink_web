'use strict';
const fs = require('fs');
const path = require('path');

module.exports = async ({ strapi }) => {
  const filePath = path.resolve(__dirname, './roles-merged.json');
  if (!fs.existsSync(filePath)) {
    console.warn('⚠️  roles-merged.json not found. Skipping import.');
    return;
  }

  const roles = JSON.parse(fs.readFileSync(filePath).toString()); // ✅ แก้ตรงนี้

  for (const role of roles) {
    const exists = await strapi.db.query('plugin::users-permissions.role').findOne({
      where: { type: role.type },
    });

    if (exists) {
      await strapi.db.query('plugin::users-permissions.role').update({
        where: { id: exists.id },
        data: {
          name: role.name,
          description: role.description,
        },
      });
      console.log(`🔁 Updated: ${role.name}`);
    } else {
      await strapi.db.query('plugin::users-permissions.role').create({
        data: {
          name: role.name,
          type: role.type,
          description: role.description,
        },
      });
      console.log(`✅ Created: ${role.name}`);
    }
  }
};
