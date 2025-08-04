'use strict';

/**
 * drug-store service
 */

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::drug-store.drug-store');
