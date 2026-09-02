import { z } from "zod";
import { ExperienceLevel, JobFilter } from "../types";

export const AIClassificationResultSchema = z.object({
  category: z.string(),
  subcategory: z.string(),
  skills: z.array(z.string()),
  experience_level: z.enum([
    "internship",
    "fresher",
    "entry_level",
    "mid_level",
    "senior",
    "executive",
    "unknown"
  ]),
  confidence: z.number().min(0).max(1),
  model: z.string(),
  version: z.string()
});
export type AIClassificationResult = z.infer<typeof AIClassificationResultSchema>;

export const ParsedSearchIntentSchema = z.object({
  keywords: z.array(z.string()).default([]),
  location: z.string().nullable().default(null),
  radius_km: z.number().nullable().default(null),
  work_mode: z.array(z.enum(["remote", "hybrid", "onsite"])).default([]),
  employment_type: z.array(z.enum([
    "full_time",
    "part_time",
    "contract",
    "internship",
    "apprenticeship",
    "temporary"
  ])).default([]),
  experience_level: z.array(z.enum([
    "internship",
    "fresher",
    "entry_level",
    "mid_level",
    "senior",
    "executive"
  ])).default([]),
  category: z.string().nullable().default(null),
  salary_min: z.number().nullable().default(null),
  salary_currency: z.string().nullable().default(null)
});
export type ParsedSearchIntent = z.infer<typeof ParsedSearchIntentSchema>;

export interface AIProvider {
  name: string;
  model: string;
  version: string;

  classifyJob(job: {
    title: string;
    description: string;
    requirements?: string[];
  }): Promise<AIClassificationResult>;

  parseSearchIntent(query: string): Promise<ParsedSearchIntent>;
}
