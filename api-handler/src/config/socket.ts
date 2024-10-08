import { Server, Socket } from "socket.io";
import { notificationStatus, socketEvents } from "./enum";
import { adminNotificationSocketService } from "../lib/sockets/notificationSocket";
import { validateAdminToken } from "../middleware/authHandler";
import mongoose from "mongoose";
import { l } from "./logger";
import { NotificationModel } from "../models/notifications";

class SocketService {
  private io: Server | undefined;
  private userSockets: Map<mongoose.Types.ObjectId, Socket>;

  constructor() {
    this.userSockets = new Map<mongoose.Types.ObjectId, Socket>();
  }

  init(httpServer) {
    this.io = new Server(httpServer);
    this.io.on(socketEvents.CONNECTION, (socket) => {
      socket.on(socketEvents.ADMIN_NOTIFICATION, async (data) => {
        const { jwtToken } = JSON.parse(data);

        const adminId = (await validateAdminToken(
          jwtToken
        )) as mongoose.Types.ObjectId;

        if (adminId) {
          this.userSockets.set(adminId, socket);
          await adminNotificationSocketService.sendUnacknowledgedNotifications(
            adminId,
            socket
          );
        } else {
          socket.emit(socketEvents.DISCONNECT);
          socket.disconnect();
        }
      });

      socket.on(socketEvents.ADMIN_NOTIFICATION_ACKNOWLEDGE, async (data) => {
        const { jwtToken, notificationId } = JSON.parse(data);

        const adminId = (await validateAdminToken(
          jwtToken
        )) as mongoose.Types.ObjectId;

        if (adminId) {
          await adminNotificationSocketService.acknowledgeNotification(
            notificationId
          );
        } else {
          socket.emit(socketEvents.DISCONNECT);
        }
      });

      socket.on(socketEvents.DISCONNECT, (socket) => {
        this.userSockets.forEach((value, key) => {
          if (value === socket) {
            this.userSockets.delete(key);
          }
        });
      });
    });
  }

  async sendNotification(adminId: mongoose.Types.ObjectId, message: string) {
    try {
      const socket = this.userSockets.get(adminId);
      const status = socket
        ? notificationStatus.ACKNOWLEDGED
        : notificationStatus.UNACKNOWLEDGED;

      const notification = await NotificationModel.create({
        adminId,
        message,
        status,
      });

      if (socket) {
        socket.emit(
          socketEvents.ADMIN_NOTIFICATION,
          JSON.stringify({
            notificationId: notification._id,
            message: notification.message,
          })
        );
      }
    } catch (error) {
      l.error("[NOTIFICATION] Error sending notification", error);
      throw error;
    }
  }
}

export const socketService = new SocketService();
