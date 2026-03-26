'use strict';

/**
 * medication-schedule service
 */

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::medication-schedule.medication-schedule');
