const queues = {
  RESEARCHER_QUEUE: "researcher-queue",
  CALCULATION_QUEUE: "calculations-queue",
};

const notificationStatus = {
  ACKNOWLEDGED: "acknowledged",
  UNACKNOWLEDGED: "unacknowledged",
};

const socketEvents = {
  CONNECTION: "connection",
  DISCONNECT: "disconnect",
  ADMIN_NOTIFICATION: "admin-notification",
  ADMIN_NOTIFICATION_ACKNOWLEDGE: "admin-notification-acknowledge",
};


Object.freeze(queues);
Object.freeze(notificationStatus);
Object.freeze(socketEvents);

export { queues, notificationStatus, socketEvents };
