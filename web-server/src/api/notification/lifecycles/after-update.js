/**
 * Lifecycle hook: After Notification Update
 * Triggers when a notification is updated in Strapi
 * Broadcasts update to all connected Socket.IO clients in relevant rooms
 */

module.exports = {
  async afterUpdate(event) {
    const { data, result } = event;
    const notification = result;

    if (!notification) return;

    console.log('[Lifecycle] Notification after-update:', {
      id: notification.id,
      documentId: notification.documentId,
      type: notification.type,
      title: notification.title,
      staff: notification.staff_profile?.documentId || notification.staff_profile?.id,
      customer: notification.customer_profile?.documentId || notification.customer_profile?.id
    });

    // Get Strapi instance from global context (use globalThis.strapi to avoid TS type issues)
    const strapi = globalThis.strapi;

    if (!strapi || !strapi.io) {
      console.warn('[Lifecycle] Socket.IO not initialized yet');
      return;
    }

    // Broadcast to rooms so all relevant clients get updated
    const io = strapi.io;

    // Broadcast to multiple rooms: notification, customer, and staff
    if (notification.documentId) {
      console.log(`[Lifecycle] Broadcasting to notification:${notification.documentId}`, {
        type: notification.type,
        title: notification.title
      });
      io.to(`notification:${notification.documentId}`).emit('notification:update', notification);
    }
    if (notification.id) {
      io.to(`notification:${notification.id}`).emit('notification:update', notification);
    }

    // Broadcast to customer room - this notifies staff when pharmacist updates customer data
    if (notification.customer_profile) {
      const customerId = typeof notification.customer_profile === 'object' 
        ? notification.customer_profile.documentId || notification.customer_profile.id 
        : notification.customer_profile;
      io.to(`customer:${customerId}`).emit('notification:update', notification);
      // Also emit customer:update event so staff view knows to refresh customer data
      io.to(`customer:${customerId}`).emit('customer:update', notification);
    }

    // Broadcast to staff room
    if (notification.staff_profile) {
      const staffId = typeof notification.staff_profile === 'object' 
        ? notification.staff_profile.documentId || notification.staff_profile.id 
        : notification.staff_profile;
      io.to(`staff:${staffId}`).emit('notification:update', notification);
    }

    console.log('[Lifecycle] Notification update broadcasted to Socket.IO clients');
  }
};

