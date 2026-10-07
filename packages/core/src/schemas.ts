import { z } from "zod";

/** One atomic, true statement from the user's base facts. The only material tailoring may use. */
export const FactSchema = z.object({
  id: z.string().min(1),
  section: z.enum(["summary", "experience", "project", "skill", "education", "certification"]),
  text: z.string().min(1),
  skills: z.array(z.string()).default([]),
});
export type Fact = z.infer<typeof FactSchema>;

/** A tailored resume line. Must cite at least one source fact. */
export const ClaimSchema = z.object({
  text: z.string().min(1),
  sourceFactIds: z.array(z.string()),
});
export type Claim = z.infer<typeof ClaimSchema>;

export const TailorResultSchema = z.object({
  fitScore: z.number().int().min(0).max(100),
  matchedSkills: z.array(z.string()),
  missingSkills: z.array(z.string()),
  summary: ClaimSchema,
  bullets: z.array(ClaimSchema),
  skills: z.array(z.string()),
});
export type TailorResult = z.infer<typeof TailorResultSchema>;
