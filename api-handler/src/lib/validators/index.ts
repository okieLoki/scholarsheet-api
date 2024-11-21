import { z } from "zod";

export const createAdminAccountValidator = z.object({
  institute_name: z
    .string()
    .min(3, "Institute name must be at least 3 characters long")
    .max(255, "Institute name must not exceed 255 characters"),
  email: z
    .string()
    .email("Invalid email address")
    .regex(
      /\.(edu|ac\.in)$/,
      "Email must be from an educational institution (.edu or .ac.in)"
    ),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters long")
    .max(255, "Password must not exceed 255 characters"),
  address: z
    .string()
    .min(3, "Address must be at least 3 characters long")
    .max(255, "Address must not exceed 255 characters"),
});

export const loginAccountValidator = z.object({
  email: z.string().email("Invalid email address"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters long")
    .max(255, "Password must not exceed 255 characters"),
});

export const addResearcherValidator = z.object({
  scholar_id: z
    .string()
    .min(3, "Scholar ID must be at least 3 characters long")
    .max(255, "Scholar ID must not exceed 255 characters"),
  email: z.string().email("Invalid email address"),
  department: z
    .string()
    .min(3, "Department must be at least 3 characters long"),
  positions: z.array(
    z.object({
      start: z
        .string()
        .refine(
          (date) => /^\d{2}-\d{2}-\d{4}$/.test(date),
          "Start date must be in the format dd-mm-yyyy"
        )
        .refine((date) => {
          const [day, month, year] = date.split("-").map(Number);
          const parsedDate = new Date(year, month - 1, day);
          return (
            parsedDate.getFullYear() === year &&
            parsedDate.getMonth() === month - 1 &&
            parsedDate.getDate() === day
          );
        }, "Start date must be a valid date"),
      end: z
        .string()
        .optional()
        .refine(
          (date) => !date || /^\d{2}-\d{2}-\d{4}$/.test(date),
          "End date must be in the format dd-mm-yyyy"
        )
        .refine((date) => {
          if (!date) return true;
          const [day, month, year] = date.split("-").map(Number);
          const parsedDate = new Date(year, month - 1, day);
          return (
            parsedDate.getFullYear() === year &&
            parsedDate.getMonth() === month - 1 &&
            parsedDate.getDate() === day
          );
        }, "End date must be a valid date"),
      position: z
        .string()
        .min(3, "Position must be at least 3 characters long"),
      institute: z
        .string()
        .min(3, "Institute name must be at least 3 characters long"),
      current: z.boolean(),
    })
  ),
  gender: z.enum(["male", "female", "other"]),
});

export const publicationFetchingFiltersValidatorAdmin = z.object({
  year: z.array(z.number()).optional(),
  journal: z.array(z.string()).optional(),
  author: z.array(z.string()).optional(),
  sort: z
    .enum([
      "title:asc",
      "title:desc",
      "year:asc",
      "year:desc",
      "author:asc",
      "author:desc",
      "citations:asc",
      "citations:desc",
    ])
    .optional(),
  topic: z.array(z.string()).optional(),
  citationsRange: z.array(z.number()).length(2).optional(),
});

export const publicationFetchingFiltersValidatorResearcher = z.object({
  year: z.array(z.number()).optional(),
  journal: z.array(z.string()).optional(),
  topic: z.array(z.string()).optional(),
  sort: z
    .enum([
      "title:asc",
      "title:desc",
      "year:asc",
      "year:desc",
      "citations:asc",
      "citations:desc",
    ])
    .optional(),
  citationsRange: z.array(z.number()).length(2).optional(),
});

export const deleteResearcherSchema = z.object({
  scholar_id: z.string().min(1, "Scholar ID is required"),
  end_date: z.string().refine(
    (value) => {
      const regex = /^\d{2}-\d{2}-\d{4}$/;
      if (!regex.test(value)) {
        throw new Error("End date must be in DD-MM-YYYY format");
      }

      const [day, month, year] = value.split("-").map(Number);
      const date = new Date(year, month - 1, day);
      return date instanceof Date && !isNaN(date.getTime());
    },
    { message: "Invalid date" }
  ),
});

export const researcherUpdateSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  email: z.string().email().optional(),
  department: z.string().optional(),
  gender: z.enum(['Male', 'Female', 'Other']).optional(),
  positions: z.array(z.string()).optional(),
}).strict();