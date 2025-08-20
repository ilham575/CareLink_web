module.exports = async (ctx, next) => {
  const user = ctx.state.user;
  if (!user) return ctx.unauthorized();

  const roleName = user.role?.name; // จาก users-permissions
  if (roleName !== 'admin') {
    return ctx.forbidden('Only admin can perform this action');
  }
  await next();
};
