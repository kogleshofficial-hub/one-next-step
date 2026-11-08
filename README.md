# One Next Step 🧠

> **You don't need the whole plan. You need the next move.**

One Next Step is a focused tool for moments when you are stuck, overwhelmed, confused, or unsure where to begin. It uses a compact open-weight language model that runs directly in the visitor's browser to identify **one concrete action to take next**.

## 🚀 Try it

**https://one-next-step.vercel.app/**

## The idea

Most productivity tools help you manage everything. One Next Step asks a smaller question:

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

## Features

- One-action AI guidance
- Context-aware progression after a completed step
- Concise reasoning for each recommendation
- Estimated time for the action
- Focus protection — what to ignore for now
- Structured-output validation
- Copyable next action
- No account required
- Responsive interface

## AI architecture

```text
Visitor's browser
      ↓
Transformers.js
      ↓
LFM2.5-350M quantized ONNX model
      ↓
WebGPU when available
      ↓
CPU/WASM fallback
      ↓
Validated structured response
      ↓
One Next Step UI
```

Inference happens on the visitor's device. The app does not send the problem to OpenRouter or another hosted AI inference API, and it does not need an AI API key.

The first use downloads approximately 300 MB of model files from Hugging Face. Transformers.js caches model files in the browser when supported. Browser storage can be cleared or evicted, in which case a download may be needed again.

## Tech stack

- Next.js 16
- React 19
- TypeScript
- Tailwind CSS
- Hugging Face Transformers.js
- LFM2.5-350M by Liquid AI
- ONNX Runtime
- Vercel
- GitHub Actions

## Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`. No Ollama service, paid AI provider, API key, or `.env.local` file is required.

## Privacy and limitations

- The problem text is processed in the browser by the local model; it is not sent to a hosted AI inference provider.
- The model download requires an internet connection the first time.
- Inference uses the visitor's device, so speed depends on the phone or computer. WebGPU is used when available; CPU/WASM is the fallback.
- This compact model can make mistakes. Treat its suggestions as assistance, not professional advice or guaranteed outcomes.

## Model license

LFM2.5-350M is distributed under the [LFM Open License v1.0](https://www.liquid.ai/lfm-license). The license permits commercial use subject to its $10 million annual-revenue threshold. Keep the license terms and attribution in place.

## Creator

Built independently by **Koglesh R. Murugan**, a student developer from Malaysia.

**Live app:** https://one-next-step.vercel.app/
