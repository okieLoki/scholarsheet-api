import mongoose from "mongoose";

export const paperSchema = new mongoose.Schema({
  researcher: {
    researcher_id: {
      type: mongoose.Types.ObjectId,
      ref: "Researcher",
      required: true,
    },
    name: {
      type: String,
      required: true,
    },
    scholar_id: {
      type: String,
      required: true,
    },
    department: {
      type: String,
      required: true,
    },
  },
  admin_id: {
    type: mongoose.Types.ObjectId,
    ref: "Admin",
  },
  title: {
    type: String,
    required: true,
  },
  link: {
    type: String,
    required: true,
  },
  authors: [
    {
      type: String,
    },
  ],
  publicationDate: {
    type: String,
    required: true,
  },
  journal: {
    type: String,
  },
  volume: {
    type: String,
  },
  issue: {
    type: String,
  },
  pages: {
    type: String,
  },
  publisher: {
    type: String,
  },
  description: {
    type: String,
  },
  totalCitations: {
    type: Number,
    default: 0,
  },
  publicationLink: {
    type: String,
  },
  pdfLink: {
    type: String,
  },
  tags: [
    {
      type: String,
    },
  ],
  lastFetch: {
    type: Date,
    default: Date.now,
  },
  previous: [
    {
      admin_id: {
        type: mongoose.Types.ObjectId,
        ref: "Admin",
      },
      department: {
        type: String,
        required: true,
      },
    },
  ],
});

export const Paper = mongoose.model("Paper", paperSchema);
