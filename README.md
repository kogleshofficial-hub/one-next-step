# One Next Step

> **You don't need the whole plan. You need the next move.**

One Next Step is a focused AI decision tool designed for moments when you're stuck, overwhelmed, confused, or unsure where to begin.

Instead of generating a huge plan, it identifies **one concrete action** you can take right now.

Complete that action, come back, and One Next Step determines what should come next.

## Why One Next Step?

Most AI assistants can give you dozens of ideas.

That's not always useful.

When you're already overwhelmed, more information can create more friction.

One Next Step follows a different philosophy:

**Problem → One Action → Progress → Next Action**

The goal is simple:

> Leave the user knowing exactly what to do next.

## Features

* **One-action AI guidance** — generates a single practical next step instead of a long plan.
* **Context-aware progression** — after completing a step, the next recommendation builds on that progress.
* **Concise reasoning** — explains why the action comes first.
* **Time estimate** — provides a realistic estimate for the action.
* **Focus protection** — identifies what to ignore for now.
* **Input validation** — protects the API from malformed and oversized requests.
* **Rate limiting** — limits repeated requests to protect the service.
* **Structured AI responses** — validates generated responses before returning them to the interface.
* **Copy action** — quickly copy the recommended next step.
* **No account required** — designed for immediate use.
* **Responsive interface** — works across desktop and smaller screens.
* **Minimal interface** — intentionally avoids unnecessary dashboards, menus, and distractions.

## The Core Experience

A user starts with something like:

> "I have an idea for an app but I don't know where to start."

Instead of receiving a 20-step roadmap, One Next Step might identify one immediate action.

The user completes it.

Then the application uses the original problem and the completed action to determine the next meaningful move.

This creates a focused progression without overwhelming the user.

## AI Architecture

The application separates the AI logic from the user interface.

```text
User
  │
  ▼
Next.js Interface
  │
  ▼
/api/next-step
  │
  ├── Input validation
  ├── Rate limiting
  └── Request handling
          │
          ▼
     AI Provider
          │
          ▼
   Hugging Face Inference
          │
          ▼
 Structured JSON response
          │
          ▼
     Schema validation
          │
          ▼
     One Next Step UI
```

The AI is instructed to prioritize:

1. The user's actual situation
2. The smallest meaningful action
3. Immediate usability
4. Logical progression
5. Avoiding unnecessary complexity

## Tech Stack

* **Next.js 16**
* **React**
* **TypeScript**
* **Tailwind CSS**
* **Hugging Face Inference**
* **Qwen/Qwen3-4B-Instruct-2507**
* **Zod** for structured response validation
* **Vercel** for deployment
* **GitHub** for source control

## Project Structure

```text
one-next-step/
│
├── app/
│   ├── api/
│   │   └── next-step/
│   │       └── route.ts
│   │
│   ├── icon.png
│   ├── layout.tsx
│   ├── page.tsx
│   ├── robots.ts
│   └── sitemap.ts
│
├── lib/
│   ├── ai.ts
│   └── prompts.ts
│
├── providers/
│   └── ai-provider.ts
│
├── public/
│
├── .env.local
├── package.json
└── README.md
```

## Running Locally

Install dependencies:

```bash
npm install
```

Create a local environment file:

```text
HF_TOKEN=your_hugging_face_token
```

Then start the development server:

```bash
npm run dev
```

Open:

```text
http://localhost:3000
```

For a production build:

```bash
npm run build
```

Then run the production server:

```bash
npm run start
```

## Environment Variables

The application requires a Hugging Face access token.

```text
HF_TOKEN=your_hugging_face_token
```

Keep this value private and never commit your `.env.local` file to GitHub.

## Production

One Next Step is deployed as a production web application.

**Live application:**

https://one-next-step.vercel.app

## Design Philosophy

The interface deliberately uses a minimal visual language.

The product should feel:

* Calm
* Focused
* Premium
* Direct
* Uncluttered

The design reinforces the product philosophy:

**Less information. More direction.**

## Security & Reliability

The API includes several protections:

* Request validation
* Maximum input lengths
* Rate limiting
* Structured AI output validation
* JSON extraction safeguards
* Retry handling for temporary AI failures
* Server-side environment variable protection

AI-generated responses are validated before they are returned to the client.

## Author

**Koglesh R. Murugan**

One Next Step is an independent project exploring how AI can help people move from uncertainty to action without overwhelming them with information.

## Status

**Production-ready**

The core experience is intentionally focused:

> **One problem. One action. One next step.**
