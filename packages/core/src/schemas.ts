import { z } from "zod";

/** One atomic, true statement from the user's base facts. The only material tailoring may use. */
export const FactSchema = z.object({
  id: z.string().min(1),
  section: z.enum(["summary", "experience", "project", "skill", "education", "certification", "other"]),
  text: z.string().min(1),
  skills: z.array(z.string()).default([]),
  /** Where the fact comes from, e.g. the role header for an experience sentence. */
  context: z.string().optional(),
});
export type Fact = z.infer<typeof FactSchema>;

/** A tailored resume line. Must cite at least one source fact. */
export const ClaimSchema = z.object({
  text: z.string().min(1),
  sourceFactIds: z.array(z.string()),
});
export type Claim = z.infer<typeof ClaimSchema>;

/** One must-have from the JD, extracted without looking at any candidate. */
export const RequirementSpecSchema = z.object({
  name: z.string().min(1),
  importance: z.enum(["core", "nice"]),
});
export type RequirementSpec = z.infer<typeof RequirementSpecSchema>;

export const RequirementListSchema = z.object({ requirements: z.array(RequirementSpecSchema) });

/** How well the user's facts cover one requirement. */
export const CoverageSchema = z.object({
  /** The requirement's number as listed in the prompt (1-based). Names get mangled; numbers don't. */
  requirement: z.number().int(),
  coverage: z.enum(["full", "partial", "none"]),
  sourceFactIds: z.array(z.string()),
});

export const RequirementSchema = RequirementSpecSchema.extend(CoverageSchema.omit({ requirement: true }).shape);
export type Requirement = z.infer<typeof RequirementSchema>;

/** What the tailoring model returns. The fit score is computed from coverage in code, not by the model. */
export const TailorDraftSchema = z.object({
  coverage: z.array(CoverageSchema),
  summary: ClaimSchema,
  bullets: z.array(ClaimSchema),
  skills: z.array(z.string()),
});
export type TailorDraft = z.infer<typeof TailorDraftSchema>;

export const TailorResultSchema = z.object({
  requirements: z.array(RequirementSchema),
  summary: ClaimSchema.nullable(),
  bullets: z.array(ClaimSchema),
  skills: z.array(z.string()),
  fitScore: z.number().int().min(0).max(100),
  matchedSkills: z.array(z.string()),
  missingSkills: z.array(z.string()),
});
export type TailorResult = z.infer<typeof TailorResultSchema>;
