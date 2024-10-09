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
  positions: z
    .array(
      z.object({
        start: z.date({
          required_error: "Start date is required",
          invalid_type_error: "Start date must be a valid date",
        }),
        end: z.date().optional(),
        position: z
          .string()
          .min(3, "Position must be at least 3 characters long"),
        institute: z
          .string()
          .min(3, "Institute name must be at least 3 characters long"),
      })
    )
    .optional(),
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
