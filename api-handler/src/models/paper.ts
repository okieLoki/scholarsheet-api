import mongoose, { InferSchemaType, Schema } from "mongoose";

export const paperSchema = new Schema({
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
    required: true,
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
});

export type PaperType = InferSchemaType<typeof paperSchema>;
export const PaperModel = mongoose.model<PaperType>("Paper", paperSchema);
