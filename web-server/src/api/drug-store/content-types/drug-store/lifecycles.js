'use strict';

module.exports = {
  async beforeCreate(event) {
    const user = event?.context?.state?.user;

    // เช็คว่า event.context ไม่มี = มาจาก Admin Panel → ข้ามการโยน error
    if (!user) {
      console.warn('No user context – likely from admin panel. Skipping owner assignment.');
      return;
    }

    event.params.data.owner = user.id;
  },

  async beforeUpdate(event) {
    if (event.params.data?.owner) {
      delete event.params.data.owner;
    }
  },
};
