import { z } from "zod";

/**
 * The exact structure that One Next Step expects
 * from its intelligence layer.
 */
export const nextStepSchema = z.object({
  nextStep: z
    .string()
    .min(1)
    .max(500)
    .describe("One specific action the user can take right now."),

  why: z
    .string()
    .min(1)
    .max(500)
    .describe("A short explanation of why this should happen first."),

  time: z
    .string()
    .min(1)
    .max(100)
    .describe("A realistic amount of time needed for the next step."),

  ignore: z
    .array(z.string().min(1).max(120))
    .min(1)
    .max(4)
    .describe("Things the user should deliberately ignore for now."),
});

export type NextStepResult = z.infer<typeof nextStepSchema>;