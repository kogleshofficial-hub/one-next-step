import { InferenceClient } from "@huggingface/inference";
import { nextStepSchema, type NextStepResult } from "../lib/ai";
import { NEXT_STEP_SYSTEM_PROMPT } from "../lib/prompts";

const token = process.env.HF_TOKEN;

if (!token) {
  throw new Error("HF_TOKEN is not configured.");
}

const client = new InferenceClient(token);

const MODEL = "Qwen/Qwen3-4B-Instruct-2507";

type GenerateNextStepOptions = {
  problem: string;
  completedStep?: string;
};

function extractJson(text: string): unknown {
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    const firstBrace = cleaned.indexOf("{");
    const lastBrace = cleaned.lastIndexOf("}");

    if (
      firstBrace === -1 ||
      lastBrace === -1 ||
      lastBrace <= firstBrace
    ) {
      throw new Error("No JSON object was found in the AI response.");
    }

    const possibleJson = cleaned.slice(firstBrace, lastBrace + 1);

    return JSON.parse(possibleJson);
  }
}

export async function generateNextStep(
  options: GenerateNextStepOptions
): Promise<NextStepResult> {
  const { problem, completedStep } = options;

  const userPrompt = completedStep
    ? `
Return ONLY a valid JSON object.

Do not use Markdown.
Do not use code fences.
Do not write an introduction.
Do not write anything before or after the JSON.

The JSON must contain exactly these fields:
- nextStep
- why
- time
- ignore

The "ignore" field must be an array of strings.

This person originally described this problem:

${problem}

They have now completed this previous step:

${completedStep}

Now determine the SINGLE most useful next action.

Important:
- Do NOT repeat the completed step.
- Do NOT give a full plan.
- Do NOT give multiple actions.
- Build naturally from the progress they have already made.
- Keep the new action specific and immediately doable.
- The new action should move them closer to solving the original problem.

Return ONLY the JSON object.
`.trim()
    : `
Return ONLY a valid JSON object.

Do not use Markdown.
Do not use code fences.
Do not write an introduction.
Do not write anything before or after the JSON.

The JSON must contain exactly these fields:
- nextStep
- why
- time
- ignore

The "ignore" field must be an array of strings.

User's problem:

${problem}

Determine the SINGLE most useful next action.

The action should be specific, realistic, and immediately doable.

Return ONLY the JSON object.
`.trim();

  const response = await client.chatCompletion({
    model: MODEL,
    messages: [
      {
        role: "system",
        content: NEXT_STEP_SYSTEM_PROMPT,
      },
      {
        role: "user",
        content: userPrompt,
      },
    ],
    max_tokens: 500,
    temperature: 0.2,
  });

  const content = response.choices?.[0]?.message?.content;

  if (!content || typeof content !== "string") {
    throw new Error("The AI returned an empty response.");
  }

  let parsed: unknown;

  try {
    parsed = extractJson(content);
  } catch {
    console.error("HF returned an unreadable response:", content);

    throw new Error("The AI returned an invalid structured response.");
  }

  const validated = nextStepSchema.safeParse(parsed);

  if (!validated.success) {
    console.error("HF returned an invalid structure:", parsed);

    throw new Error("The AI response did not match the required format.");
  }

  return validated.data;
}