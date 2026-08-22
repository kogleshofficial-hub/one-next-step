import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://one-next-step.vercel.app"),

  title: {
    default: "One Next Step — You Don't Need the Whole Plan",
    template: "%s — One Next Step",
  },

  description:
    "Turn whatever is stopping you into one clear action you can take right now. You don't need the whole plan. You need the next move.",

  keywords: [
    "one next step",
    "productivity",
    "decision making",
    "clarity",
    "action",
    "problem solving",
    "focus",
  ],

  authors: [
    {
      name: "Koglesh R. Murugan",
    },
  ],

  creator: "Koglesh R. Murugan",

  openGraph: {
    title: "One Next Step",
    description:
      "You don't need the whole plan. You need the next move.",
    type: "website",
    siteName: "One Next Step",
    url: "https://one-next-step.vercel.app",
  },

  twitter: {
    card: "summary_large_image",
    title: "One Next Step",
    description:
      "Turn a problem into one clear action you can take right now.",
  },

  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}