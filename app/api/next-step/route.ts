import { NextResponse } from "next/server";
import { generateNextStep } from "../../../providers/ai-provider";

const MAX_PROBLEM_LENGTH = 1000;
const MAX_COMPLETED_STEP_LENGTH = 1000;

const MAX_REQUESTS_PER_WINDOW = 10;
const RATE_LIMIT_WINDOW_MS = 60_000;

type RequestBody = {
  problem?: unknown;
  completedStep?: unknown;
};

type RateLimitEntry = {
  count: number;
  resetAt: number;
};

const rateLimitStore = new Map<string, RateLimitEntry>();

function getClientIdentifier(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for");

  if (forwardedFor) {
    return forwardedFor.split(",")[0].trim();
  }

  return request.headers.get("x-real-ip") ?? "unknown";
}

function isRateLimited(identifier: string): boolean {
  const now = Date.now();
  const existing = rateLimitStore.get(identifier);

  if (!existing || now >= existing.resetAt) {
    rateLimitStore.set(identifier, {
      count: 1,
      resetAt: now + RATE_LIMIT_WINDOW_MS,
    });

    return false;
  }

  existing.count += 1;

  if (existing.count > MAX_REQUESTS_PER_WINDOW) {
    return true;
  }

  return false;
}

export async function POST(request: Request) {
  try {
    const identifier = getClientIdentifier(request);

    if (isRateLimited(identifier)) {
      return NextResponse.json(
        {
          error:
            "Too many requests. Please wait a minute and try again.",
        },
        {
          status: 429,
          headers: {
            "Retry-After": "60",
          },
        }
      );
    }

    let body: RequestBody;

    try {
      body = (await request.json()) as RequestBody;
    } catch {
      return NextResponse.json(
        { error: "Invalid request." },
        { status: 400 }
      );
    }

    if (typeof body.problem !== "string") {
      return NextResponse.json(
        { error: "Please provide a problem." },
        { status: 400 }
      );
    }

    const problem = body.problem.trim();

    if (!problem) {
      return NextResponse.json(
        { error: "Please describe what you're stuck on." },
        { status: 400 }
      );
    }

    if (problem.length > MAX_PROBLEM_LENGTH) {
      return NextResponse.json(
        {
          error:
            "Your problem is too long. Please keep it under 1000 characters.",
        },
        { status: 400 }
      );
    }

    let completedStep: string | undefined;

    if (typeof body.completedStep === "string") {
      completedStep = body.completedStep.trim();

      if (completedStep.length > MAX_COMPLETED_STEP_LENGTH) {
        return NextResponse.json(
          {
            error:
              "The completed step is too long. Please try again.",
          },
          { status: 400 }
        );
      }

      if (!completedStep) {
        completedStep = undefined;
      }
    }

    const result = await generateNextStep({
      problem,
      completedStep,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("NEXT_STEP_ERROR:", error);

    return NextResponse.json(
      {
        error:
          "We couldn't create your next step right now. Please try again.",
      },
      { status: 500 }
    );
  }
}