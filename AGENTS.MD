# AGENTS

## Project overview

This project is a Node.js + Playwright runner where an LLM orchestrates browser actions to find and extract a lunch menu (dish names + prices).

## Key commands

- Install deps: `npm install`
- Install browsers: `npx playwright install`
- Run with config: `npm run start`

## Files to know

- `src/index.js`: main loop and tool schema for LLM actions.
- `src/browser.js`: Playwright actions implementation + element snapshots.
- `src/llm.js`: LLM client for `ollama` and OpenAI-compatible endpoints.
- `src/config.js`: config defaults and validation.
- `schemas/action.schema.json`: action JSON schema (Ajv).
- `docs/CONFIGURATION.md`: config schema.
- `docs/ARCHITECTURE.md`: action protocol and control flow.

## LLM action contract

The LLM must return a single JSON object with `type` and the relevant fields. Supported types: `click`, `type`, `scroll`, `wait`, `navigate`, `screenshot`, `extract`, `done`. Extraction content must be an array of `{ dish, price }` objects. Responses are validated against `schemas/action.schema.json`.

## Adding features

- New action types: update `src/browser.js`, `schemas/action.schema.json`, and the tool schema in `src/index.js`.
- New LLM providers: extend `src/llm.js` with another payload/response mapping and add config flags.
- More observability: extend `src/logger.js` and add structured log fields in `src/index.js`.

## Guardrails

- Keep responses strict JSON for the LLM output.
- Preserve config-driven behavior (no hard-coded URLs or models).
- Avoid large payloads; respect `maxHtmlChars`, `maxTextChars`, and `snapshotsLimit`.
- Maintain headless support.\n- If a modal/fullscreen popup blocks the page, have the LLM close it before other actions.
