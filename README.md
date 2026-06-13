# SteadyMind

SteadyMind is a private, accessible mental wellness tracker for students preparing for high-stakes exams. It combines daily mood check-ins with open-ended journaling, local pattern analysis, contextual coping suggestions, and a conservative crisis-support flow.

## Run locally

```powershell
$env:GEMINI_API_KEY="your-api-key"
node server.js
```

Open `http://localhost:4173`.

## Test

```powershell
node --test
```

The suite validates signal analysis, streak calculations, input bounding, prompt construction,
crisis bypass behavior, AI request security settings, fallback behavior, HTTP security headers,
content-type enforcement, and API routes.

## Design and safety

- **Generative AI:** A server-only Gemini `generateContent` integration uses structured output to generate contextual reflections, coping strategies, adaptive mindfulness exercises, encouragement, and follow-up questions. The default model is `gemini-2.5-flash-lite` with thinking disabled for low latency; override it with `GEMINI_MODEL`.
- **Privacy:** Complete journal history stays in browser `localStorage`. Only the submitted message and a minimized five-entry context are sent for generation. API keys remain server-side. There are no accounts, ads, analytics, or cookies.
- **Safety:** Direct self-harm language interrupts normal coaching and shows immediate human-support options. The interface clearly states that it is not medical care.
- **Accessibility:** Semantic headings and fieldsets, keyboard navigation, visible focus states, live status messages, high contrast, responsive layouts, reduced-motion support, and text alternatives for charts.
- **Efficiency:** Zero runtime dependencies, small static assets, no model calls on each keystroke, and a minimal local server with security headers.
- **Maintainability:** Analysis logic is isolated in `wellness.js`, model integration in `ai-service.js`, HTTP concerns in `server.js`, and UI behavior in `app.js`. Tests use Node's built-in runner.

## Production GenAI integration

Without `GEMINI_API_KEY`, the app remains usable with deterministic local support. Gemini requests use structured JSON, safety filters, timeouts, body limits, rate limiting, output validation, and a deterministic crisis detector that operates independently of the model.

The current emergency links are intended for India: emergency services at `112` and Tele-MANAS at `14416`.
