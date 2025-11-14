'use strict';

/**
 * drug service
 */

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::drug.drug');
