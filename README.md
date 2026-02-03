# GroupLunch-Search2

LLM-orchestrated Playwright runner that navigates a website, finds the lunch menu, and extracts dish names with prices. The LLM decides each browser action (click, scroll, type, screenshot) based on the current page state.

## Quick start

1) Install dependencies

```
npm install
npx playwright install
```

2) Copy and edit the config

```
copy config.example.json config.json
```

3) Run

```
npm run start
```

The extraction result is written to `extracted-menu.json`.

## How it works

- Chromium opens the `targetUrl` (headless or not).
- HTML, visible text, element snapshots, and optional screenshots are sent to the LLM.
- The LLM responds with a JSON action.
- The app executes the action via Playwright.
- The loop continues until the LLM returns `type: "extract"` or `"done"`.

## Configuration

See `docs/CONFIGURATION.md` for the full schema and examples.

## Debugging

Set `debugLevel` to `debug` or `trace` to see request/response payloads and action logs. Screenshots for each step are stored in `screenshotDir`.

## Notes

- `llmApiType` supports `ollama` (default dev), `openai` (OpenAI-compatible chat endpoint), and `azure` (Azure OpenAI deployments).
- Ollama structured outputs are enabled by default; set `structuredOutputs` to `false` if you want raw output.
- The LLM must return strict JSON. If it responds with invalid JSON or missing dish/price fields, the runner logs a warning and re-asks on the next step.\n- If a modal or fullscreen popup blocks the page, the LLM should close it before proceeding.
- The HTML, visible text, and element snapshots are truncated to control token usage.

