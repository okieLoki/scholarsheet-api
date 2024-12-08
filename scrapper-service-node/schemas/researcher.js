import mongoose from "mongoose";

export const researcherSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  scholar_id: {
    type: String,
    required: true,
    unique: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
  },
  department: {
    type: String,
    required: true,
  },
  gender: {
    type: String,
    required: true,
  },
  verified: {
    type: Boolean,
    default: false,
  },
  admin_id: {
    type: mongoose.Types.ObjectId,
    ref: "Admin",
  },
  citations: {
    type: Number,
  },
  h_index: {
    type: Number,
  },
  i_index: {
    type: Number,
  },
  totalPapers: {
    type: Number,
  },
  positions: [
    {
      start: {
        type: String,
        required: true,
      },
      end: {
        type: String,
      },
      position: {
        type: String,
        required: true,
      },
      institute: {
        type: String,
        required: true,
      },
      current: {
        type: Boolean,
        required: true,
      },
    },
  ],
  previousAdmins: [
    {
      type: mongoose.Types.ObjectId,
      ref: "Admin",
    },
  ],
  lastFetch: {
    type: Date,
  },
});

researcherSchema.index({ name: "text", department: "text" });

export const Researcher = mongoose.model("Researcher", researcherSchema);
