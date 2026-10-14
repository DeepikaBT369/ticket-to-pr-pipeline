# Ticket to PR Pipeline

A real Locator/Fixer/Gate/PR-Agent pipeline for a seeded bug (BUG-4821),
with a React front end (built from the Figma Make export) wired to a
Node/Express backend that actually runs the work.

## Run locally

```
npm install
npm run build      # builds the React client into client/dist
npm start          # starts Express, serving the UI + API on one port
```

Open http://localhost:3000

## Deploy (Render, Railway, Fly.io, etc.)

This is a single Node service — no separate front-end host needed, since
Express serves the built client and the API from the same origin.

Configure your host with:
- Build command: `npm install && npm run build`
- Start command: `npm start`
- Node version: 18+ (uses the built-in `node --test` runner)

That's it — one service, one URL, submit that URL.

## What's real vs. not yet

- Real: file search (Locator), candidate patches tested against the real
  test suite with `node --test` (Fixer), syntax + test + static-scan
  re-verification (Gate), a real generated diff (PR Agent), and Approval
  actually writes the winning fix to `target-repo/src/checkoutFlow.js`.
- AI Fixer: when `ANTHROPIC_API_KEY` is set, the Fixer asks Claude (default
  model `claude-sonnet-5-5`, override with `ANTHROPIC_MODEL`) to write 3
  candidate fixes per ticket. Each one is still run against the real tests.
  If the key is missing or the API call fails, the app falls back to the
  pre-written candidates in `server/tickets.js` and says so on screen.
- Not yet real: the Cost & Ablation stage is illustrative.

## Setting the API key

Never commit the key. Locally:

    ANTHROPIC_API_KEY=your-key npm start

On Render: Environment tab, add `ANTHROPIC_API_KEY`.