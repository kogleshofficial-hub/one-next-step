import { nextStepSchema, type NextStepResult } from "../lib/ai";
import { NEXT_STEP_SYSTEM_PROMPT } from "../lib/prompts";

type GenerateNextStepOptions = {
  problem: string;
  completedStep?: string;
};

type OllamaResponse = {
  message?: {
    content?: unknown;
  };
};

const MODEL = "llama3.2:3b";
const OLLAMA_URL = "http://127.0.0.1:11434/api/chat";

const MAX_ATTEMPTS = 3;
const RETRY_BASE_DELAY_MS = 500;

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
    const firstBrace = cleaned.indexOf("{");
    const lastBrace = cleaned.lastIndexOf("}");

    if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
      throw new Error("No JSON object was found in the AI response.");
    }

    try {
      return JSON.parse(cleaned.slice(firstBrace, lastBrace + 1));
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

Identify the NEXT smallest meaningful action.

The new action MUST:
- logically follow from the completed step;
- never repeat the completed step;
- address the next meaningful bottleneck;
- be possible to begin immediately;
- contain exactly ONE primary action;
- not become a checklist or multi-step plan.
`
    : `
ORIGINAL PROBLEM:
${problem}

This is the user's first step.

Identify the smallest meaningful action that creates real forward movement.

The action MUST:
- address the actual blocker;
- be specific enough to begin immediately;
- contain exactly ONE primary action;
- not become a checklist or multi-step plan.
`;

  return `
Return ONLY one valid JSON object.

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

CRITICAL:
"nextStep" must contain exactly ONE primary action.

Do not hide multiple actions using:
"and then", "then", "after that", "followed by", "while", or "also".

"ignore" should contain 2–4 useful distractions or later decisions.

Do not invent facts about the user.
Do not diagnose the user.
Do not make professional medical, legal, or financial decisions.

If the request involves danger, illegal activity, self-harm, or another unsafe situation, give a safe appropriate next action instead.

${continuationContext}

Return the JSON now.
`.trim();
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

  return validated.data;
}

async function generateOnce(
  userPrompt: string
): Promise<NextStepResult> {
  const response = await fetch(OLLAMA_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        {
          role: "system",
          content: `
${NEXT_STEP_SYSTEM_PROMPT}

IMPORTANT:
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
      stream: false,
      format: "json",
      options: {
        temperature: 0.15,
        num_ctx: 4096,
        num_predict: 300,
      },
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    const errorText = await response.text();

    console.error("OLLAMA_ERROR:", response.status, errorText);

    throw new Error(
      "The local AI engine could not be reached. Make sure Ollama is running."
    );
  }

  const data: OllamaResponse = await response.json();

  const content =
    typeof data.message?.content === "string"
      ? data.message.content.trim()
      : "";

  if (!content) {
    throw new Error("The local AI engine returned no analysis.");
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