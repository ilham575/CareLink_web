module.exports = (policyContext, config, { strapi }) => {
  const user = policyContext.state.user;
  if (!user) {
    return policyContext.unauthorized();
  }
  const roleName = user.role?.name;
  if (roleName !== 'admin') {
    return policyContext.forbidden('Only admin can perform this action');
  }
  return true; // ผ่าน policy
};
