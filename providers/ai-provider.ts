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
      reasoning?: unknown;
    };
  }>;
  error?: {
    message?: string;
    code?: string | number;
  };
};

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

// OpenRouter automatically selects an available free model.
const MODEL = "openrouter/free";

const MAX_ATTEMPTS = 3;
const RETRY_BASE_DELAY_MS = 700;

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
Return exactly one valid JSON object.

Required structure:

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

Rules:

- "nextStep" MUST contain exactly ONE primary action.
- Do not create a checklist.
- Do not hide multiple objectives inside one sentence.
- "why" should be concise.
- "time" should be realistic.
- "ignore" must contain 2–4 useful distractions or later concerns.
- Do not invent facts about the user.
- Do not diagnose the user.
- If the request is unsafe, provide a safe appropriate next action instead.

${continuationContext}

Return JSON only.
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
      throw new Error("No JSON object found in AI response.");
    }

    const candidate = cleaned.slice(firstBrace, lastBrace + 1);

    try {
      return JSON.parse(candidate);
    } catch {
      throw new Error("AI returned malformed JSON.");
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

    throw new Error("AI response failed validation.");
  }

  const result = validated.data;

  if (!result.nextStep.trim()) {
    throw new Error("AI returned an empty next step.");
  }

  if (!result.why.trim()) {
    throw new Error("AI returned an empty explanation.");
  }

  if (!result.time.trim()) {
    throw new Error("AI returned an empty time estimate.");
  }

  if (result.ignore.length === 0) {
    throw new Error("AI returned no ignore items.");
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

IMPORTANT:
Return ONLY one valid JSON object.
No Markdown.
No code fences.
No explanation outside the JSON.
          `.trim(),
        },
        {
          role: "user",
          content: userPrompt,
        },
      ],

      temperature: 0.1,
      max_tokens: 500,

      // Ask OpenRouter for structured JSON.
      response_format: {
        type: "json_object",
      },

      stream: false,
    }),

    cache: "no-store",
  });

  const rawText = await response.text();

  let data: OpenRouterResponse;

  try {
    data = JSON.parse(rawText) as OpenRouterResponse;
  } catch {
    console.error(
      "OPENROUTER_INVALID_RESPONSE:",
      rawText.slice(0, 4000)
    );

    throw new Error("OpenRouter returned an invalid response.");
  }

  if (!response.ok) {
    console.error(
      "OPENROUTER_ERROR:",
      response.status,
      JSON.stringify(data).slice(0, 4000)
    );

    throw new Error(
      data.error?.message ??
        `OpenRouter request failed with status ${response.status}.`
    );
  }

  const messageContent = data.choices?.[0]?.message?.content;

  let content = "";

  if (typeof messageContent === "string") {
    content = messageContent.trim();
  } else if (Array.isArray(messageContent)) {
    content = messageContent
      .map((part) => {
        if (
          typeof part === "object" &&
          part !== null &&
          "text" in part &&
          typeof part.text === "string"
        ) {
          return part.text;
        }

        return "";
      })
      .join("")
      .trim();
  }

  if (!content) {
    console.error(
      "OPENROUTER_EMPTY_RESPONSE:",
      JSON.stringify(data).slice(0, 6000)
    );

    throw new Error("The AI returned no usable result.");
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