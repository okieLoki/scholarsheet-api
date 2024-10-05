import mongoose, { InferSchemaType, Schema } from "mongoose";

const adminSchema = new Schema(
  {
    institute_name: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
    },
    password: {
      type: String,
      required: true,
    },
    address: {
      type: String,
      required: true,
    },
    verified: {
      type: Boolean,
      default: false,
    },
    email_verification_token: {
      type: String,
    },
    email_verification_token_expiry: {
      type: Date,
    },
    google_id: {
      type: String,
    },
    departments: {
      type: [String],
    },
  },
  {
    timestamps: true,
  }
);

export type AdminType = InferSchemaType<typeof adminSchema>;
export const AdminModel = mongoose.model<AdminType>("Admin", adminSchema);
