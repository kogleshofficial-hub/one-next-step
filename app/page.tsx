"use client";

import { FormEvent, useState } from "react";
import { NEXT_STEP_SYSTEM_PROMPT } from "../lib/prompts";

type NextStepResult = {
  nextStep: string;
  why: string;
  time: string;
  ignore: string[];
};

const MAX_PROBLEM_LENGTH = 1000;

type LocalAIProgress = { status?: string; progress?: number; file?: string };
type LocalAIMessage = { role: "system" | "user" | "assistant"; content: string };

declare global {
  interface Window {
    localAI?: {
      generate: (
        messages: LocalAIMessage[],
        onProgress?: (event: LocalAIProgress) => void,
        maxNewTokens?: number
      ) => Promise<string>;
    };
  }
}

let localAIScriptPromise: Promise<void> | null = null;

function ensureLocalAI(): Promise<void> {
  if (typeof window === "undefined") return Promise.reject(new Error("Local AI requires a browser."));
  if (window.localAI) return Promise.resolve();

  if (!localAIScriptPromise) {
    localAIScriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.type = "module";
      script.src = "/local-ai.js";
      script.onload = () => resolve();
      script.onerror = () => {
        localAIScriptPromise = null;
        reject(new Error("The local AI runtime could not load. Check your connection and try again."));
      };
      document.head.appendChild(script);
    });
  }

  return localAIScriptPromise;
}

function parseModelJson(text: string): unknown {
  const cleaned = text.trim().replace(/^\x60{3}(?:json)?\s*/i, "").replace(/\s*\x60{3}$/i, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("The on-device model returned an incomplete answer. Please try again.");
  try {
    return JSON.parse(cleaned.slice(start, end + 1)) as unknown;
  } catch {
    throw new Error("The on-device model returned invalid structured output. Please try again.");
  }
}


const EXAMPLES = [
  "I want to build my first website but I don't know where to start.",
  "I have an exam coming up and I keep procrastinating.",
  "I have an idea for a project but I keep overthinking it.",
  "I want to learn coding but there are too many things to learn.",
];

function isValidResult(value: unknown): value is NextStepResult {
  if (!value || typeof value !== "object") {
    return false;
  }

  const result = value as Record<string, unknown>;

  return (
    typeof result.nextStep === "string" &&
    typeof result.why === "string" &&
    typeof result.time === "string" &&
    Array.isArray(result.ignore) &&
    result.ignore.every((item) => typeof item === "string")
  );
}

export default function Home() {
  const [problem, setProblem] = useState("");
  const [result, setResult] = useState<NextStepResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [stepNumber, setStepNumber] = useState(1);
  const [copied, setCopied] = useState(false);
  const [modelStatus, setModelStatus] = useState("");

  async function requestNextStep(
    currentProblem: string,
    completedStep?: string
  ) {
    if (loading) return;

    setLoading(true);
    setError("");
    setCopied(false);
    setModelStatus("Preparing the on-device model. The first download is about 300 MB and is cached by your browser.");

    try {
      await ensureLocalAI();
      const continuation = completedStep
        ? `The user has completed this previous action: ${completedStep}
Continue from the original problem. Give the next smallest meaningful action. Do not repeat the completed action.`
        : "This is the first action. Identify the smallest meaningful action that addresses the actual blocker.";

      const userPrompt = `ORIGINAL PROBLEM:
${currentProblem}

${continuation}

Return only one JSON object with exactly these fields:
{"nextStep":"one specific action","why":"why this comes first","time":"realistic time estimate","ignore":["one distraction to ignore","another distraction to ignore"]}

Rules: one primary action only; no checklist; do not invent facts; keep it specific, safe, practical, and proportional to the problem.`;

      const generated = await window.localAI!.generate(
        [
          { role: "system", content: NEXT_STEP_SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
        (event) => {
          if (event.status === "progress" && typeof event.progress === "number") {
            setModelStatus(`Downloading model files: ${Math.round(event.progress)}% · This happens only on first use unless browser storage is cleared.`);
          } else if (event.status === "initiate") {
            setModelStatus("Downloading the local AI model. Keep this tab open for the first setup.");
          } else if (event.status === "done") {
            setModelStatus("Model ready. Generating your next step on this device…");
          } else if (event.status === "ready") {
            setModelStatus("Model ready. Generating your next step on this device…");
          }
        },
        220
      );

      const parsed = parseModelJson(generated);
      if (!isValidResult(parsed)) {
        throw new Error("The local model did not return the required next-step format. Please try once more with a little more context.");
      }

      setResult(parsed);
      setModelStatus("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "The on-device AI could not complete this request.");
      setModelStatus("");
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (loading) {
      return;
    }

    const trimmedProblem = problem.trim();

    if (!trimmedProblem) {
      setError("Tell us what's stopping you first.");
      return;
    }

    if (trimmedProblem.length > MAX_PROBLEM_LENGTH) {
      setError("Keep your problem under 1000 characters.");
      return;
    }

    setResult(null);
    setStepNumber(1);

    await requestNextStep(trimmedProblem);
  }

  async function handleCompletedStep() {
    if (!result || loading) {
      return;
    }

    const completedStep = result.nextStep;

    setStepNumber((current) => current + 1);

    await requestNextStep(problem.trim(), completedStep);
  }

  function handleReset() {
    if (loading) {
      return;
    }

    setProblem("");
    setResult(null);
    setError("");
    setStepNumber(1);
    setCopied(false);
  }

  function handleExample(example: string) {
    if (loading) {
      return;
    }

    setProblem(example);
    setError("");

    window.setTimeout(() => {
      document.getElementById("problem")?.focus();
    }, 0);
  }

  async function handleCopy() {
    if (!result) {
      return;
    }

    try {
      await navigator.clipboard.writeText(result.nextStep);
      setCopied(true);

      window.setTimeout(() => {
        setCopied(false);
      }, 1800);
    } catch {
      setError("Couldn't copy the step. You can select and copy it manually.");
    }
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#070809] text-white selection:bg-white selection:text-black">
      {/* Ambient background */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.035]"
        aria-hidden="true"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.5) 1px, transparent 1px)",
          backgroundSize: "64px 64px",
        }}
      />

      <div
        className="pointer-events-none absolute left-1/2 top-[-300px] h-[600px] w-[900px] -translate-x-1/2 rounded-full bg-white/[0.035] blur-3xl"
        aria-hidden="true"
      />

      <div className="relative mx-auto flex min-h-screen w-full max-w-7xl flex-col px-5 sm:px-8 lg:px-12">
        {/* Navigation */}
        <header className="flex items-center justify-between border-b border-white/[0.06] py-6">
        <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/30">
            Koglesh R. Murugan
          </div>

          <button
            type="button"
            onClick={handleReset}
            disabled={loading}
            className="group flex items-center gap-3 text-sm font-semibold tracking-[-0.02em] text-white transition-opacity hover:opacity-70 disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Reset One Next Step"
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-xs transition-colors group-hover:border-white/20">
              1
            </span>

            ONE NEXT STEP
          </button>

          <div className="hidden items-center gap-3 text-[10px] font-semibold uppercase tracking-[0.22em] text-white/30 sm:flex">
            <span className="h-1.5 w-1.5 rounded-full bg-white/40" />
            Clarity
            <span className="text-white/15">→</span>
            Action
          </div>
        </header>

        {/* Main */}
        <section className="flex flex-1 flex-col justify-center py-14 sm:py-20 lg:py-24">
          {!result ? (
            /* =========================
               LANDING / INPUT
               ========================= */
            <div className="mx-auto w-full max-w-5xl">
              <div className="grid gap-14 lg:grid-cols-[1fr_360px] lg:items-end">
                <div>
                  <div className="mb-7 flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.22em] text-white/35">
                    <span className="h-px w-8 bg-white/30" />
                    A simpler way forward
                  </div>

                  <h1 className="max-w-4xl text-5xl font-semibold leading-[0.91] tracking-[-0.065em] sm:text-7xl lg:text-[88px]">
                    You don&apos;t need
                    <br />
                    the whole plan.
                    <br />
                    <span className="text-white/35">
                      Just the next move.
                    </span>
                  </h1>

                  <p className="mt-8 max-w-xl text-base leading-7 text-white/45 sm:text-lg">
                    Tell us what you&apos;re stuck on. We&apos;ll turn the
                    problem into one clear action you can take right now.
                  </p>
                </div>

                <div className="hidden rounded-2xl border border-white/[0.07] bg-white/[0.025] p-5 lg:block">
                  <div className="mb-5 flex items-center justify-between">
                    <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/30">
                      The idea
                    </span>

                    <span className="rounded-full border border-white/10 px-2.5 py-1 text-[9px] font-medium uppercase tracking-[0.15em] text-white/30">
                      One thing
                    </span>
                  </div>

                  <div className="space-y-3">
                    <div className="rounded-xl border border-white/[0.07] bg-black/20 p-4">
                      <div className="mb-2 text-[10px] uppercase tracking-[0.16em] text-white/25">
                        Problem
                      </div>

                      <div className="text-sm leading-6 text-white/45">
                        Too many things to figure out.
                      </div>
                    </div>

                    <div className="flex justify-center text-white/20">
                      ↓
                    </div>

                    <div className="rounded-xl border border-white/10 bg-white/[0.045] p-4">
                      <div className="mb-2 text-[10px] uppercase tracking-[0.16em] text-white/35">
                        Next
                      </div>

                      <div className="text-sm font-medium leading-6 text-white/75">
                        Start with the smallest useful action.
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="mt-14">
                <label
                  htmlFor="problem"
                  className="mb-3 block text-sm font-medium text-white/70"
                >
                  What&apos;s stopping you?
                </label>

                <div className="group rounded-2xl border border-white/10 bg-white/[0.035] p-2 transition-all duration-300 focus-within:border-white/25 focus-within:bg-white/[0.05] focus-within:shadow-[0_0_80px_rgba(255,255,255,0.045)]">
                  <textarea
                    id="problem"
                    value={problem}
                    onChange={(event) => {
                      setProblem(event.target.value);

                      if (error) {
                        setError("");
                      }
                    }}
                    placeholder="I have an idea, but I don't know where to start..."
                    rows={5}
                    maxLength={MAX_PROBLEM_LENGTH}
                    disabled={loading}
                    aria-describedby="problem-counter"
                    className="w-full resize-none bg-transparent px-4 py-4 text-base leading-7 text-white outline-none placeholder:text-white/20 disabled:cursor-wait disabled:opacity-60 sm:px-5 sm:text-lg"
                  />

                  <div className="flex items-center justify-between border-t border-white/[0.07] px-2 pt-2 sm:px-3">
                    <span
                      id="problem-counter"
                      className={`px-2 text-xs ${
                        problem.length >= 900
                          ? "text-white/50"
                          : "text-white/25"
                      }`}
                    >
                      {problem.length}/{MAX_PROBLEM_LENGTH}
                    </span>

                    <button
                      type="submit"
                      disabled={!problem.trim() || loading}
                      className="rounded-xl bg-white px-5 py-3 text-sm font-semibold text-black transition-all duration-200 hover:bg-white/90 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-30"
                    >
                      {loading ? (
                        <span className="flex items-center gap-2">
                          <span
                            className="flex gap-1"
                            aria-hidden="true"
                          >
                            <span className="h-1 w-1 animate-pulse rounded-full bg-black" />
                            <span className="h-1 w-1 animate-pulse rounded-full bg-black [animation-delay:150ms]" />
                            <span className="h-1 w-1 animate-pulse rounded-full bg-black [animation-delay:300ms]" />
                          </span>

                          Finding your next step...
                        </span>
                      ) : (
                        <>
                          Get my next step
                          <span className="ml-2">→</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </form>

              {loading && <p className="mt-4 text-xs leading-6 text-white/35" aria-live="polite">{modelStatus}</p>}

              {/* Examples */}
              <div className="mt-7">
                <div className="mb-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/25">
                  Need an example?
                </div>

                <div className="flex flex-wrap gap-2">
                  {EXAMPLES.map((example) => (
                    <button
                      key={example}
                      type="button"
                      onClick={() => handleExample(example)}
                      disabled={loading}
                      className="rounded-full border border-white/[0.07] bg-white/[0.02] px-3.5 py-2 text-xs text-white/35 transition-all hover:border-white/15 hover:bg-white/[0.05] hover:text-white/65 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {example.length > 48
                        ? `${example.slice(0, 48)}...`
                        : example}
                    </button>
                  ))}
                </div>
              </div>

              {error && (
                <div
                  role="alert"
                  className="mt-5 rounded-xl border border-red-400/20 bg-red-400/[0.06] px-4 py-3 text-sm leading-6 text-red-200/80"
                >
                  {error}
                </div>
              )}

              <div className="mt-8 flex flex-wrap gap-x-5 gap-y-2 text-xs text-white/20">
                <span>Runs on your device</span>
                <span>•</span>
                <span>No AI API key or provider credits</span>
                <span>•</span>
                <span>One action at a time</span>
              </div>

              <p className="mt-6 max-w-2xl text-[11px] leading-5 text-white/20">
                Local AI: LFM2.5-350M by Liquid AI · <a className="underline underline-offset-2 hover:text-white/50" href="https://www.liquid.ai/lfm-license" target="_blank" rel="noreferrer">LFM Open License v1.0</a>. First use downloads approximately 300 MB; generation runs in this browser.
              </p>
            </div>
          ) : (
            /* =========================
               RESULT / FOCUS MODE
               ========================= */
            <div className="mx-auto w-full max-w-4xl">
              {/* Top controls */}
              <div className="mb-10 flex items-center justify-between">
                <button
                  type="button"
                  onClick={handleReset}
                  disabled={loading}
                  className="text-sm text-white/35 transition-colors hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                >
                  ← Start over
                </button>

                <div className="flex items-center gap-3">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/25">
                    Progress
                  </span>

                  <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs font-medium text-white/55">
                    Step {String(stepNumber).padStart(2, "0")}
                  </span>
                </div>
              </div>

              {/* Heading */}
              <div className="mb-10">
                <div className="mb-6 flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.22em] text-white/35">
                  <span className="h-px w-8 bg-white/30" />
                  Your next step
                </div>

                <h1 className="text-5xl font-semibold leading-[0.92] tracking-[-0.06em] sm:text-7xl lg:text-[82px]">
                  Make the problem
                  <br />
                  <span className="text-white/35">smaller.</span>
                </h1>

                <p className="mt-6 max-w-xl text-sm leading-6 text-white/35">
                  You don&apos;t have to solve everything today. Complete this
                  one step, then we&apos;ll figure out what comes next.
                </p>
              </div>

              {/* Progress indicator */}
              <div className="mb-5 flex items-center gap-2">
                <div className="h-1 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
                  <div
                    className="h-full rounded-full bg-white transition-all duration-700"
                    style={{
                      width: `${Math.min(100, 22 + stepNumber * 13)}%`,
                    }}
                  />
                </div>

                <span className="text-[10px] font-medium text-white/25">
                  MOVING FORWARD
                </span>
              </div>

              {/* Main card */}
              <div className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.035] shadow-[0_30px_100px_rgba(0,0,0,0.3)]">
                {/* Original problem */}
                <div className="border-b border-white/[0.08] p-6 sm:p-8">
                  <div className="mb-3 flex items-center justify-between">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/25">
                      Your problem
                    </p>

                    <span className="text-[10px] text-white/15">
                      Context
                    </span>
                  </div>

                  <p className="max-w-3xl text-base leading-7 text-white/45">
                    &ldquo;{problem.trim()}&rdquo;
                  </p>
                </div>

                {/* Next step */}
                <div className="relative p-6 sm:p-10">
                  <div className="absolute right-6 top-6 h-24 w-24 rounded-full bg-white/[0.025] blur-2xl" />

                  <div className="relative">
                    <div className="mb-5 flex items-center justify-between">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/30">
                        Do this now
                      </p>

                      <button
                        type="button"
                        onClick={handleCopy}
                        className="rounded-lg border border-white/[0.07] px-3 py-1.5 text-[10px] font-medium text-white/30 transition-all hover:border-white/15 hover:bg-white/[0.04] hover:text-white/60"
                        aria-label="Copy next step"
                      >
                        {copied ? "Copied ✓" : "Copy"}
                      </button>
                    </div>

                    <p className="max-w-3xl text-2xl font-medium leading-9 tracking-[-0.03em] text-white sm:text-4xl sm:leading-[1.25]">
                      {result.nextStep}
                    </p>

                    {/* Meta */}
                    <div className="mt-9 grid gap-3 sm:grid-cols-2">
                      <div className="rounded-2xl border border-white/[0.07] bg-black/20 p-5">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/25">
                          Estimated time
                        </p>

                        <p className="mt-2 text-sm font-medium text-white/70">
                          {result.time}
                        </p>
                      </div>

                      <div className="rounded-2xl border border-white/[0.07] bg-black/20 p-5">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/25">
                          Focus
                        </p>

                        <p className="mt-2 text-sm font-medium text-white/70">
                          One action
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Why */}
                <div className="border-t border-white/[0.08] p-6 sm:p-8">
                  <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/25">
                    Why this first
                  </p>

                  <p className="max-w-2xl text-sm leading-7 text-white/45 sm:text-base">
                    {result.why}
                  </p>
                </div>

                {/* Ignore */}
                <div className="border-t border-white/[0.08] p-6 sm:p-8">
                  <p className="mb-4 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/25">
                    Ignore for now
                  </p>

                  <div className="flex flex-wrap gap-2">
                    {result.ignore.map((item, index) => (
                      <span
                        key={`${item}-${index}`}
                        className="rounded-full border border-white/[0.07] bg-white/[0.025] px-3 py-1.5 text-xs text-white/35"
                      >
                        {item}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Complete action */}
              <div className="mt-6">
                <button
                  type="button"
                  onClick={handleCompletedStep}
                  disabled={loading}
                  className="group flex w-full items-center justify-center gap-3 rounded-2xl bg-white px-6 py-4 text-sm font-semibold text-black shadow-[0_10px_50px_rgba(255,255,255,0.08)] transition-all duration-200 hover:bg-white/90 hover:shadow-[0_15px_60px_rgba(255,255,255,0.12)] active:scale-[0.99] disabled:cursor-wait disabled:opacity-50"
                >
                  {loading ? (
                    <>
                      <span className="flex gap-1" aria-hidden="true">
                        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-black" />
                        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-black [animation-delay:150ms]" />
                        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-black [animation-delay:300ms]" />
                      </span>

                      Finding what comes next...
                    </>
                  ) : (
                    <>
                      <span className="flex h-5 w-5 items-center justify-center rounded-full border border-black/20 text-xs transition-transform group-hover:scale-110">
                        ✓
                      </span>

                      I DID IT — GIVE ME THE NEXT STEP
                      <span className="transition-transform group-hover:translate-x-1">
                        →
                      </span>
                    </>
                  )}
                </button>

                <p className="mt-3 text-center text-[10px] uppercase tracking-[0.16em] text-white/15">
                  Complete the action above before continuing
                </p>
              </div>

              {error && (
                <div
                  role="alert"
                  className="mt-5 rounded-xl border border-red-400/20 bg-red-400/[0.06] px-4 py-3 text-sm leading-6 text-red-200/80"
                >
                  {error}
                </div>
              )}

              {/* Secondary action */}
              <div className="mt-8 flex justify-center">
                <button
                  type="button"
                  onClick={handleReset}
                  disabled={loading}
                  className="text-xs text-white/25 transition-colors hover:text-white/55 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  I want to work on something else
                </button>
              </div>
            </div>
          )}
        </section>

        {/* Footer */}
        <footer className="flex flex-col gap-3 border-t border-white/[0.07] py-6 text-xs text-white/25 sm:flex-row sm:items-center sm:justify-between">
  <span>© {new Date().getFullYear()} One Next Step</span>

  <div className="flex flex-col gap-1 sm:items-end">
    <span>Built for people who are stuck.</span>
    <span className="text-white/15">Created by Koglesh R. Murugan</span>
  </div>
</footer>
      </div>
    </main>
  );
}