import { NextResponse } from "next/server";

// This endpoint is intentionally retired. All generation now runs in the visitor's browser.
export async function POST() {
  return NextResponse.json(
    { error: "One Next Step now runs its AI model locally in your browser. Reload the app and try again." },
    { status: 410 }
  );
}
