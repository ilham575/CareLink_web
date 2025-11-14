'use strict';

/**
 * drug controller
 */

const { createCoreController } = require('@strapi/strapi').factories;

module.exports = createCoreController('api::drug.drug');
