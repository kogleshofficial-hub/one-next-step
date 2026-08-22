"use client";

import { FormEvent, useState } from "react";

type NextStepResult = {
  nextStep: string;
  why: string;
  time: string;
  ignore: string[];
};

const MAX_PROBLEM_LENGTH = 1000;

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

    setLoading(true);
    setError("");
    setResult(null);

    try {
      const response = await fetch("/api/next-step", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          problem: trimmedProblem,
        }),
      });

      const contentType = response.headers.get("content-type") ?? "";

      if (!contentType.includes("application/json")) {
        throw new Error(
          "The server returned an unexpected response. Please try again."
        );
      }

      const data: unknown = await response.json();

      if (!response.ok) {
        const message =
          typeof data === "object" &&
          data !== null &&
          "error" in data &&
          typeof data.error === "string"
            ? data.error
            : "Something went wrong. Please try again.";

        throw new Error(message);
      }

      if (!isValidResult(data)) {
        throw new Error(
          "We received an unexpected answer. Please try again."
        );
      }

      setResult(data);
    } catch (err) {
      if (err instanceof TypeError) {
        setError(
          "We couldn't reach One Next Step. Check your connection and try again."
        );
      } else {
        setError(
          err instanceof Error
            ? err.message
            : "Something went wrong. Please try again."
        );
      }
    } finally {
      setLoading(false);
    }
  }

  function handleReset() {
    if (loading) {
      return;
    }

    setProblem("");
    setResult(null);
    setError("");
  }

  return (
    <main className="min-h-screen bg-[#08090a] text-white selection:bg-white selection:text-black">
      <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-6 sm:px-8 lg:px-12">
        <header className="flex items-center justify-between py-7">
          <button
            type="button"
            onClick={handleReset}
            className="text-sm font-semibold tracking-[-0.02em] text-white transition-opacity hover:opacity-70 disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Reset One Next Step"
            disabled={loading}
          >
            ONE NEXT STEP
          </button>

          <div className="hidden text-xs font-medium tracking-[0.18em] text-white/40 sm:block">
            CLARITY → ACTION
          </div>
        </header>

        <section className="flex flex-1 flex-col justify-center py-16 sm:py-24">
          {!result ? (
            <div className="mx-auto w-full max-w-4xl">
              <div className="mb-10">
                <div className="mb-7 flex items-center gap-3 text-xs font-medium uppercase tracking-[0.2em] text-white/40">
                  <span className="h-px w-8 bg-white/30" />
                  A simpler way forward
                </div>

                <h1 className="max-w-4xl text-5xl font-semibold leading-[0.95] tracking-[-0.055em] sm:text-7xl lg:text-8xl">
                  You don&apos;t need
                  <br />
                  the whole plan.
                  <br />
                  <span className="text-white/40">
                    Just the next move.
                  </span>
                </h1>

                <p className="mt-8 max-w-xl text-base leading-7 text-white/50 sm:text-lg">
                  Tell us what you&apos;re stuck on. We&apos;ll turn the
                  problem into one clear action you can take right now.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="mt-12">
                <label
                  htmlFor="problem"
                  className="mb-3 block text-sm font-medium text-white/70"
                >
                  What&apos;s stopping you?
                </label>

                <div className="group rounded-2xl border border-white/10 bg-white/[0.035] p-2 transition-all duration-300 focus-within:border-white/25 focus-within:bg-white/[0.05] focus-within:shadow-[0_0_60px_rgba(255,255,255,0.04)]">
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
                    rows={4}
                    maxLength={MAX_PROBLEM_LENGTH}
                    disabled={loading}
                    aria-describedby="problem-counter"
                    className="w-full resize-none bg-transparent px-4 py-3 text-base leading-7 text-white outline-none placeholder:text-white/25 disabled:cursor-wait disabled:opacity-60 sm:px-5 sm:text-lg"
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
                          <span className="flex gap-1" aria-hidden="true">
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

              {error && (
                <div
                  role="alert"
                  className="mt-4 rounded-xl border border-red-400/20 bg-red-400/[0.06] px-4 py-3 text-sm leading-6 text-red-200/80"
                >
                  {error}
                </div>
              )}

              <div className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-xs text-white/25">
                <span>No account required</span>
                <span>•</span>
                <span>No complicated system</span>
                <span>•</span>
                <span>Just one next step</span>
              </div>
            </div>
          ) : (
            <div className="mx-auto w-full max-w-3xl">
              <button
                type="button"
                onClick={handleReset}
                className="mb-12 text-sm text-white/40 transition-colors hover:text-white"
              >
                ← Start over
              </button>

              <div className="mb-10">
                <div className="mb-6 flex items-center gap-3 text-xs font-medium uppercase tracking-[0.2em] text-white/40">
                  <span className="h-px w-8 bg-white/30" />
                  Your next step
                </div>

                <h1 className="text-5xl font-semibold leading-[0.95] tracking-[-0.05em] sm:text-7xl">
                  Make the problem
                  <br />
                  <span className="text-white/40">smaller.</span>
                </h1>
              </div>

              <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.035]">
                <div className="p-6 sm:p-8">
                  <p className="mb-3 text-xs font-medium uppercase tracking-[0.18em] text-white/35">
                    You said
                  </p>

                  <p className="text-base leading-7 text-white/60">
                    &ldquo;{problem.trim()}&rdquo;
                  </p>
                </div>

                <div className="border-t border-white/[0.08] p-6 sm:p-8">
                  <p className="mb-4 text-xs font-medium uppercase tracking-[0.18em] text-white/35">
                    Right now
                  </p>

                  <p className="text-2xl font-medium leading-9 tracking-[-0.025em] sm:text-3xl">
                    {result.nextStep}
                  </p>

                  <div className="mt-8 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-xl border border-white/[0.07] bg-black/20 p-4">
                      <p className="text-xs uppercase tracking-[0.15em] text-white/30">
                        Time
                      </p>

                      <p className="mt-2 text-sm font-medium text-white/75">
                        {result.time}
                      </p>
                    </div>

                    <div className="rounded-xl border border-white/[0.07] bg-black/20 p-4">
                      <p className="text-xs uppercase tracking-[0.15em] text-white/30">
                        Focus
                      </p>

                      <p className="mt-2 text-sm font-medium text-white/75">
                        One action
                      </p>
                    </div>
                  </div>
                </div>

                <div className="border-t border-white/[0.08] p-6 sm:p-8">
                  <p className="mb-3 text-xs font-medium uppercase tracking-[0.18em] text-white/35">
                    Why this first
                  </p>

                  <p className="max-w-2xl text-base leading-7 text-white/55">
                    {result.why}
                  </p>
                </div>

                <div className="border-t border-white/[0.08] p-6 sm:p-8">
                  <p className="mb-4 text-xs font-medium uppercase tracking-[0.18em] text-white/35">
                    Ignore for now
                  </p>

                  <div className="flex flex-wrap gap-2">
                    {result.ignore.map((item, index) => (
                      <span
                        key={`${item}-${index}`}
                        className="rounded-full border border-white/[0.08] bg-white/[0.025] px-3 py-1.5 text-xs text-white/40"
                      >
                        {item}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={handleReset}
                className="mt-6 rounded-xl border border-white/10 px-5 py-3 text-sm font-medium text-white/60 transition-all hover:border-white/20 hover:bg-white/[0.04] hover:text-white"
              >
                I have another problem →
              </button>
            </div>
          )}
        </section>

        <footer className="flex flex-col gap-3 border-t border-white/[0.07] py-6 text-xs text-white/25 sm:flex-row sm:items-center sm:justify-between">
          <span>© {new Date().getFullYear()} One Next Step</span>
          <span>Built for people who are stuck.</span>
        </footer>
      </div>
    </main>
  );
}