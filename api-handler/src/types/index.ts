import mongoose from "mongoose";

export type ResearcherData = {
  name: string;
  emailEnding: string;
  citations: string;
  hIndex: string;
  i10Index: string;
};
export type Article = {
  title: string;
  link: string;
  authors: string[];
  publication: string;
  publicationYear: number;
  totalCitations: number;
  researcher_id?: mongoose.Types.ObjectId;
};
export type ArticleExtended = {
  title: string;
  link: string;
  authors: string[];
  publicationDate: string;
  journal: string;
  volume: string;
  issue: string;
  pages: string;
  publisher: string;
  description: string;
  totalCitations: number;
  publicationLink: string;
  pdfLink: string;
  researcher_id?: string;
};
export type PublicationFetchingFilters = {
  year?: string[];
  journal?: string[];
  author?: string[];
  topic?: string[];
  citationsRange?: [number, number];
};
