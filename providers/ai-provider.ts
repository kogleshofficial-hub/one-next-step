import { nextStepSchema, type NextStepResult } from "../lib/ai";
import { NEXT_STEP_SYSTEM_PROMPT } from "../lib/prompts";

type GenerateNextStepOptions = {
  problem: string;
  completedStep?: string;
};

type OpenRouterResponse = {
  choices?: Array<{
    message?: {
      content?: unknown;
    };
  }>;
};

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const MODEL = "google/gemma-4-31b-it:free";

const MAX_ATTEMPTS = 2;
const RETRY_BASE_DELAY_MS = 500;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

Identify the NEXT smallest meaningful action.

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
Return exactly one JSON object with this structure:

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

"nextStep" must contain exactly ONE primary action.

Do not hide multiple actions inside one sentence using:
"and then", "then", "after that", "followed by", "while", or "also".

"ignore" should contain 2–4 relevant distractions, premature concerns, or later decisions.

"why" should be concise.

"time" should be realistic, such as:
"5 minutes", "10 minutes", "15–20 minutes", or "30 minutes".

Do not invent facts about the user.
Do not diagnose the user.

If the request involves danger, illegal activity, self-harm, or another unsafe situation, give a safe appropriate next action instead.

${continuationContext}

FINAL CHECK:
1. Exactly one primary next action.
2. Concrete.
3. Immediately actionable.
4. Addresses the actual situation.
5. Does not repeat a completed step.
6. Not a disguised multi-step plan.
7. Concise explanation.
8. Realistic time.
9. Useful ignore items.
10. Valid JSON only.

Return the JSON object now.
`.trim();
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
    const firstBrace = cleaned.indexOf("{");
    const lastBrace = cleaned.lastIndexOf("}");

    if (
      firstBrace === -1 ||
      lastBrace === -1 ||
      lastBrace <= firstBrace
    ) {
      throw new Error("No JSON object was found.");
    }

    const candidate = cleaned.slice(firstBrace, lastBrace + 1);

    try {
      return JSON.parse(candidate);
    } catch {
      throw new Error("The AI returned malformed JSON.");
    }
  }
}

function validateResult(value: unknown): NextStepResult {
  const validated = nextStepSchema.safeParse(value);

  if (!validated.success) {
    console.error(
      "NEXT_STEP_INVALID_STRUCTURE:",
      validated.error.flatten()
    );

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
  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY is not configured.");
  }

  const response = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://one-next-step.vercel.app",
      "X-Title": "One Next Step",
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        {
          role: "system",
          content: `
${NEXT_STEP_SYSTEM_PROMPT}

Return ONLY valid JSON.
No Markdown.
No code fences.
No explanation outside the JSON object.
          `.trim(),
        },
        {
          role: "user",
          content: userPrompt,
        },
      ],
      temperature: 0.15,
      max_tokens: 300,
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    const errorText = await response.text();

    console.error(
      "OPENROUTER_ERROR:",
      response.status,
      errorText
    );

    throw new Error("OpenRouter AI request failed.");
  }

  const data: OpenRouterResponse = await response.json();

  const content =
    typeof data.choices?.[0]?.message?.content === "string"
      ? data.choices[0].message.content.trim()
      : "";

  if (!content) {
    console.error(
      "OPENROUTER_EMPTY_RESPONSE:",
      JSON.stringify(data).slice(0, 4000)
    );

    throw new Error("The AI returned no result.");
  }

  return validateResult(extractJson(content));
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

  for (
    let attempt = 1;
    attempt <= MAX_ATTEMPTS;
    attempt += 1
  ) {
    try {
      return await generateOnce(userPrompt);
    } catch (error) {
      lastError = error;

      console.error(
        `NEXT_STEP_AI_ATTEMPT_${attempt}_FAILED:`,
        error
      );

      if (attempt < MAX_ATTEMPTS) {
        await sleep(RETRY_BASE_DELAY_MS * attempt);
      }
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("AI generation failed.");
}