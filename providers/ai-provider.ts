import { InferenceClient } from "@huggingface/inference";
import { nextStepSchema, type NextStepResult } from "../lib/ai";
import { NEXT_STEP_SYSTEM_PROMPT } from "../lib/prompts";

const token = process.env.HF_TOKEN;

if (!token) {
  throw new Error("HF_TOKEN is not configured.");
}

const client = new InferenceClient(token);

const MODEL = "Qwen/Qwen3-4B-Instruct-2507";

const MAX_ATTEMPTS = 3;
const RETRY_BASE_DELAY_MS = 500;
const MAX_OUTPUT_TOKENS = 500;
const TEMPERATURE = 0.15;

type GenerateNextStepOptions = {
  problem: string;
  completedStep?: string;
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function extractJson(text: string): unknown {
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    // Some models occasionally add a short sentence before the JSON.
    // Recover the outermost JSON object without accepting arbitrary prose.
    const firstBrace = cleaned.indexOf("{");
    const lastBrace = cleaned.lastIndexOf("}");

    if (
      firstBrace === -1 ||
      lastBrace === -1 ||
      lastBrace <= firstBrace
    ) {
      throw new Error("No JSON object was found in the AI response.");
    }

    const candidate = cleaned.slice(firstBrace, lastBrace + 1);

    try {
      return JSON.parse(candidate);
    } catch {
      throw new Error("The AI returned malformed JSON.");
    }
  }
}

function buildUserPrompt({
  problem,
  completedStep,
}: GenerateNextStepOptions): string {
  const continuationContext = completedStep
    ? `
This is a continuation.

ORIGINAL PROBLEM:
${problem}

STEP THE USER ALREADY COMPLETED:
${completedStep}

The completed step is genuine progress.

Your job is to identify the NEXT smallest meaningful action.

The new action MUST:
- logically follow from the completed step;
- never repeat the completed step;
- address the next meaningful bottleneck;
- be possible to begin immediately;
- contain exactly ONE primary action;
- not become a checklist or multi-step plan;
- remain proportional to the original problem.
`
    : `
ORIGINAL PROBLEM:
${problem}

This is the user's first step.

Identify the smallest meaningful action that creates real forward movement.

The action MUST:
- address the actual blocker;
- be specific enough to begin immediately;
- be meaningful rather than merely easy;
- contain exactly ONE primary action;
- not become a checklist or multi-step plan.
`;

  return `
Return ONLY one valid JSON object.

No Markdown.
No code fences.
No introduction.
No explanation outside the JSON.
No additional fields.

Required JSON shape:

{
  "nextStep": "one specific action",
  "why": "a brief explanation of why this comes first",
  "time": "a realistic estimate",
  "ignore": [
    "thing to ignore for now",
    "thing to ignore for now",
    "thing to ignore for now"
  ]
}

CRITICAL RULE:

"nextStep" must describe ONE primary action.

Do NOT hide multiple actions inside one sentence using words such as:
"and then"
"then"
"after that"
"followed by"
"while"
"also"

If completing the action naturally requires several tiny physical movements, that is acceptable. But the user should have ONE clear objective, not a sequence of objectives.

"ignore" should contain 2–4 relevant distractions, premature concerns, or later decisions.

"why" should normally be 1–2 concise sentences.

"time" should be realistic and simple, such as:
"5 minutes"
"10 minutes"
"15–20 minutes"
"30 minutes"

Do not invent facts about the user.

Do not diagnose the user.

Do not make professional medical, legal, or financial decisions for the user.

If the request involves danger, illegal activity, self-harm, or another unsafe situation, do not provide instructions for carrying it out. Give a safe, appropriate next action instead.

${continuationContext}

FINAL CHECK BEFORE RESPONDING:

1. Exactly one primary next action.
2. It is concrete.
3. It can begin immediately.
4. It addresses the actual situation.
5. It does not repeat a completed step.
6. It is not a disguised plan.
7. The explanation is concise.
8. The time estimate is realistic.
9. The ignore items are genuinely useful.
10. Return JSON only.

Return the JSON now.
`.trim();
}

function validateResult(value: unknown): NextStepResult {
  const validated = nextStepSchema.safeParse(value);

  if (!validated.success) {
    console.error("NEXT_STEP_INVALID_STRUCTURE:", validated.error.flatten());
    throw new Error("The AI response failed validation.");
  }

  const result = validated.data;

  if (!result.nextStep.trim()) {
    throw new Error("The AI returned an empty next step.");
  }

  if (!result.why.trim()) {
    throw new Error("The AI returned an empty explanation.");
  }

  if (!result.time.trim()) {
    throw new Error("The AI returned an empty time estimate.");
  }

  if (result.ignore.length === 0) {
    throw new Error("The AI returned no ignore items.");
  }

  return result;
}

async function generateOnce(
  userPrompt: string
): Promise<NextStepResult> {
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
    max_tokens: MAX_OUTPUT_TOKENS,
    temperature: TEMPERATURE,
  });

  const content = response.choices?.[0]?.message?.content;

  if (!content || typeof content !== "string") {
    throw new Error("The AI returned an empty response.");
  }

  let parsed: unknown;

  try {
    parsed = extractJson(content);
  } catch (error) {
    console.error("NEXT_STEP_INVALID_JSON:", {
      error,
      content: content.slice(0, 2000),
    });

    throw new Error("The AI returned invalid JSON.");
  }

  return validateResult(parsed);
}

export async function generateNextStep(
  options: GenerateNextStepOptions
): Promise<NextStepResult> {
  const problem = options.problem.trim();
  const completedStep = options.completedStep?.trim();

  if (!problem) {
    throw new Error("A problem is required.");
  }

  const userPrompt = buildUserPrompt({
    problem,
    completedStep: completedStep || undefined,
  });

  let lastError: unknown;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      return await generateOnce(userPrompt);
    } catch (error) {
      lastError = error;

      console.error(`NEXT_STEP_AI_ATTEMPT_${attempt}_FAILED:`, error);

      if (attempt < MAX_ATTEMPTS) {
        await sleep(RETRY_BASE_DELAY_MS * attempt);
      }
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("AI generation failed.");
}