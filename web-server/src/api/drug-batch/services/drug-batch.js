'use strict';

/**
 * drug-batch service
 */

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::drug-batch.drug-batch');
