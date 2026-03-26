'use strict';

module.exports = {
  routes: [
    {
      method: 'POST',
      path: '/notifications/assign-to-staff',
      handler: 'notification.assignToStaff',
      config: {
        policies: [],
      },
    },
  ],
};