$env:NVIDIA_API_KEY="your_api_key"
node server.mjs

# Rockstar Lens

AI packaged commodity compliance checker with camera/image intake, OCR + vision inspection, seven-point label validation, health and technology intelligence, market comparison, multilingual reports, PDF printing, and ElevenLabs voice output.

## Local development

```bash
npm install
npm run dev
```

The production server is started with `npm start` after `npm run build`.

## Server environment

Set these values in Render or a local `.env`-equivalent process environment. Never put provider keys in React or commit them to Git:

- `GEMINI_API_KEY` required for the primary Gemini vision path.
- `GEMINI_MODEL` optional, defaults to `gemini-2.5-flash`.
- `NVIDIA_API_KEY` fallback vision provider when Gemini is unavailable.
- `NVIDIA_MODEL` optional, defaults to `meta/llama-3.2-11b-vision-instruct`.
- `ELEVENLABS_API_KEY` required for the voice report button.
- `ELEVENLABS_VOICE_ID` optional, defaults to a multilingual voice.

### Render vision configuration

1. Open the `rockstar-lens` service in Render.
2. Open **Environment** and create `NVIDIA_API_KEY`.
3. Paste the NVIDIA key as the value, save, and click **Manual Deploy → Deploy latest commit**.
4. Confirm the key name is exactly `NVIDIA_API_KEY`; `sync: false` in `render.yaml` declares the secret but cannot fill it automatically.

The backend also accepts `NVIDIA_NIM_API_KEY` and `NVAPI_KEY` for existing deployments, but `NVIDIA_API_KEY` is the recommended name.

The app uses Gemini first and NVIDIA vision as a fallback. The API returns visible-evidence-only JSON and marks unreadable fields as `REVIEW` or `UNKNOWN`; it does not invent prices, dates, manufacturers, or certifications.