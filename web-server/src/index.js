'use strict';
const importRoles = require('../scripts/importRoles');

module.exports = {
  register() {},
  async bootstrap({ strapi }) {
    await importRoles({ strapi });
  },
};
