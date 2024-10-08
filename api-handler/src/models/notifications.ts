import mongoose, { Schema, InferSchemaType } from "mongoose";

const notificationSchema = new Schema({
  adminId: {
    type: Schema.Types.ObjectId,
    ref: "Admin",
    required: true,
  },
  message: {
    type: String,
    required: true,
  },
  status: {
    type: String,
    enum: ["unacknowledged", "acknowledged"],
    default: "unacknowledged",
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
});

export type NotificationType = InferSchemaType<typeof notificationSchema>;
export const NotificationModel = mongoose.model<NotificationType>(
  "Notification",
  notificationSchema
);
