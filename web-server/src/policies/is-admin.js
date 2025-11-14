'use strict';

const { PolicyError } = require('@strapi/utils').errors;

module.exports = (policyContext, config, { strapi }) => {
  const ctx = policyContext;
  
  if (!ctx.state.user) {
    throw new PolicyError('You must be logged in', { policy: 'is-admin' });
  }

  const userRole = ctx.state.user.role?.type;
  if (userRole !== 'admin') {
    throw new PolicyError('You must be an admin to access this resource', { policy: 'is-admin' });
  }

  return true;
};
