module.exports = {
  rest: {
    defaultLimit: 25,
    maxLimit: 100,
    withCount: true,
  },
  // Prevent response size issues
  responseLimit: '10mb',
};
