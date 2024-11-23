import mongoose from "mongoose";

export type ResearcherData = {
  name: string;
  emailEnding: string;
  citations: string;
  hIndex: string;
  i10Index: string;
  imageUrl: string;
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
export type PublicationFetchingFiltersAdmin = {
  year?: string[];
  journal?: string[];
  sort?:
    | "title:asc"
    | "title:desc"
    | "year:asc"
    | "year:desc"
    | "author:asc"
    | "author:desc"
    | "citations:asc"
    | "citations:desc";
  author?: string[];
  topic?: string[];
  citationsRange?: [number, number];
};
export type PublicationFetchingFiltersResearcher = {
  year?: string[];
  journal?: string[];
  sort?:
    | "title:asc"
    | "title:desc"
    | "year:asc"
    | "year:desc"
    | "citations:asc"
    | "citations:desc";
  topic?: string[];
  citationsRange?: [number, number];
};
export interface AdminInterface {
  id: mongoose.Types.ObjectId | string;
  email: string;
}