import { Socket } from "socket.io";
import { NotificationModel } from "../../models/notifications";
import { AdminModel } from "../../models/admin";
import { notificationStatus, socketEvents } from "../../config/enum";
import { l } from "../../config/logger";
import mongoose from "mongoose";
import { socketService } from "../../config/socket";

class AdminNotificationSocketService{
  async sendUnacknowledgedNotifications(
    adminId: mongoose.Types.ObjectId,
    socket: Socket
  ) {
    try {
      const admin = await AdminModel.findById(adminId);

      if (admin) {
        const unacknowledgedNotifications = await NotificationModel.find({
          adminId: admin._id,
          status: notificationStatus.UNACKNOWLEDGED,
        })
          .sort({ timestamp: -1 })
          .lean();

        for (const notification of unacknowledgedNotifications) {
          socket.emit(
            socketEvents.ADMIN_NOTIFICATION,
            JSON.stringify({
              notificationId: notification._id,
              message: notification.message,
            })
          );
        }
      }
    } catch (error) {
      l.error(
        "[NOTIFICATION] Error sending unacknowledged notifications",
        error
      );
      throw error;
    }
  }

  async acknowledgeNotification(notificationId: mongoose.Types.ObjectId) {
    try {
      await NotificationModel.findByIdAndUpdate(
        {
          _id: notificationId,
        },
        {
          status: notificationStatus.ACKNOWLEDGED,
        }
      );
    } catch (error) {
      l.error("[NOTIFICATION] Error acknowledging notification", error);
      throw error;
    }
  }
}

const adminNotificationSocketService = new AdminNotificationSocketService();
export { adminNotificationSocketService };
