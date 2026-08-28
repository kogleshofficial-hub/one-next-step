# Contributing to One Next Step

Thanks for helping improve One Next Step.

## Development

Install dependencies and run the app locally:

```bash
npm install
npm run dev
```

Before opening a pull request, run:

```bash
npm run lint
npx tsc --noEmit
npm run build
```

## Product principles

Changes should support the core experience:

**Problem → One Action → Progress → Next Action**

Prefer focused improvements over adding unnecessary dashboards, steps, or complexity.

## AI and API expectations

Keep validation and server-side secret handling intact. AI output should remain structured and validated before reaching the interface.

## Pull requests

Keep changes focused and explain what changed, why it helps, and how it was tested.
