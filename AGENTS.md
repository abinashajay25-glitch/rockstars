# AI Agent Instructions

## Project shape

- The application lives in `client/` and is a Vite React 19 frontend plus a custom Node HTTP server.
- `client/src/main.tsx` is the frontend entrypoint. `client/src/App.css` owns the main visual system; keep styling changes consistent with its existing tokens and responsive rules.
- `client/server.mjs` owns the production server, static-file fallback, `POST /api/analyze`, and `POST /api/voice-report`.
- The current checkout has no `client/src/App.tsx`; treat that as a source-tree issue and verify the file exists before changing frontend behavior.

## Commands

Run commands from `client/`:

```text
npm install
npm run dev       # Vite development server only
npm run build     # strict TypeScript build, then Vite production build
npm run lint      # Oxlint
npm run start     # serves client/dist with server.mjs
npm run preview   # previews the Vite build
```

There is no automated test script. After code changes, prefer `npm run build` and `npm run lint`; use both when the change crosses frontend and server boundaries.

## Backend and security conventions

- Keep provider credentials server-side in `process.env`; never put API keys in React code, committed files, or browser requests.
- Vision analysis uses Gemini first when configured, then NVIDIA as the fallback. The NVIDIA key aliases are `NVIDIA_API_KEY`, `NVIDIA_NIM_API_KEY`, and `NVAPI_KEY`; `NVIDIA_API_KEY` is the recommended deployment name.
- Preserve the visible-evidence-only report contract in `server.mjs`: unreadable values must remain `REVIEW` or `UNKNOWN`, and model output must be normalized before returning it.
- `/api/analyze` accepts a multipart image upload capped at 15 MB. `/api/voice-report` accepts JSON and limits report text to 5,000 characters.
- `npm run dev` starts Vite without a configured API proxy. API calls need the Node server running separately or an explicitly added proxy; do not assume Vite forwards `/api/*`.
- Render builds with `npm ci && npm run build` and starts with `npm start`. `render.yaml` declares secrets with `sync: false`, so deployment values must be entered in Render.

## Implementation and validation

- Respect strict TypeScript settings in `client/tsconfig.app.json`, especially `noUnusedLocals`, `noUnusedParameters`, and `noFallthroughCasesInSwitch`.
- Keep frontend API calls aligned with the server routes and response shape before changing either side.
- Avoid unrelated generated-output or dependency churn. Do not commit secrets, `dist/`, or local environment files.
- For UI work, test the responsive and print/report states represented in `App.css`, then run the build and lint commands.

See [client/README.md](client/README.md) for deployment environment variables and the Render troubleshooting note.