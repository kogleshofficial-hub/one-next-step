# One Next Step 🧠

> **You don't need the whole plan. You need the next move.**

One Next Step is a focused AI decision tool for moments when you are stuck, overwhelmed, confused, or unsure where to begin.

Instead of producing another giant plan, it identifies **one concrete action you can take right now**.

## 🚀 Try it

**https://one-next-step.vercel.app/**

## The idea

Most productivity tools help you manage everything.

One Next Step asks a smaller question:

> **What is the one useful thing I should do next?**

The core loop is:

```text
Problem
   ↓
One Action
   ↓
Progress
   ↓
Next Action
```

## ✨ Features

- 🎯 One-action AI guidance
- 🧠 Context-aware progression
- 💬 Concise reasoning for each recommendation
- ⏱️ Estimated time for the action
- 🚫 Focus protection — what to ignore for now
- 🛡️ Input validation and request limits
- 📋 Copyable next action
- 👤 No account required
- 📱 Responsive interface
- ✨ Minimal, distraction-free UI

## 🤖 AI architecture

```text
User
  ↓
Next.js interface
  ↓
/api/next-step
  ├── Input validation
  ├── Rate limiting
  └── Request handling
          ↓
       AI provider
          ↓
        Ollama
          ↓
     Local AI model
          ↓
   Structured response
          ↓
    Schema validation
          ↓
    One Next Step UI
```

The system prioritizes the user's actual situation, the smallest meaningful action, immediate usefulness, and logical progression.

## 🛠️ Tech stack

- Next.js 16
- React
- TypeScript
- Tailwind CSS
- Ollama
- Llama 3.2 3B
- Zod
- Vercel
- GitHub

## 💻 Run locally

```bash
npm install
```

Make sure Ollama is installed and running:

```bash
ollama --version
ollama list
```

The current local model is:

```text
llama3.2:3b
```

If needed:

```bash
ollama pull llama3.2:3b
```

Then run the application:

```bash
npm run dev
```

Open `http://localhost:3000`.

## ⚠️ Deployment note

The current AI engine uses Ollama running locally. A normal Vercel deployment cannot directly access an Ollama server running on a personal computer. A production AI endpoint therefore needs a separately hosted model or production-compatible provider.

## 🔐 Reliability

The API includes request validation, input limits, rate limiting, structured-response validation, JSON safeguards, and server-side handling of sensitive configuration.

## 🎨 Design philosophy

The interface intentionally stays calm and minimal.

**Less information. More direction.**

## 🚧 Status

**Active development.**

This project is an experiment in using AI to reduce decision friction rather than increase information overload.

## 👨‍💻 Creator

Built independently by **Koglesh R. Murugan**, a 16-year-old developer from Malaysia.

**Live app:** https://one-next-step.vercel.app/
