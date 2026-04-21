<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/8ce5b5da-f3f9-445f-88a6-b916215b5e70

## Architecture

The Gemini API key is kept **server-side only**. The browser calls a small
Express proxy (`server/index.ts`) which forwards requests to Gemini.
Never expose `GEMINI_API_KEY` to client code.

## Run Locally

**Prerequisites:** Node.js

1. Install dependencies: `npm install`
2. Create `.env.local` with your key: `GEMINI_API_KEY="..."`
3. In one terminal, start the API: `npm run dev:server`
4. In another, start the frontend: `npm run dev`

The Vite dev server proxies `/api/*` to the Express server on port 8787.

## Production

1. `npm run build` — builds the frontend to `dist/`
2. `npm start` — runs the Express server which serves `dist/` and the API
