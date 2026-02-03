# Architecture

## Components

- `src/index.js`: Orchestrator loop. Loads config, launches browser, sends state to the LLM, executes actions.
- `src/browser.js`: Playwright helpers for navigation, screenshots, visible text, element snapshots, and actions.
- `src/llm.js`: LLM client (Ollama or OpenAI-compatible).
- `src/config.js`: Config loading and defaults.
- `src/logger.js`: Simple leveled logger.
- `schemas/action.schema.json`: JSON schema used to validate LLM actions (Ajv).

## LLM Action Contract

The LLM must return a JSON object with a single action. Supported actions:

- `click`: `{ "type": "click", "selector": ".btn" }` or `{ "x": 100, "y": 200 }`
- `type`: `{ "type": "type", "selector": "#search", "text": "lunch", "submit": true }`
- `scroll`: `{ "type": "scroll", "direction": "down", "amount": 600 }`
- `wait`: `{ "type": "wait", "ms": 1000 }`
- `navigate`: `{ "type": "navigate", "url": "https://..." }`
- `screenshot`: `{ "type": "screenshot", "name": "menu.png", "fullPage": true }`
- `extract`: `{ "type": "extract", "content": [{ "dish": "...", "price": "..." }] }`
- `done`: `{ "type": "done", "content": [{ "dish": "...", "price": "..." }] }`

## Control Flow

1) Open `targetUrl`.
2) Build the LLM state:
   - URL
   - Element snapshots (optional)
   - Visible text (optional)
   - HTML (optional)
   - Screenshot path (optional)
   - Last action/result/error\n  - Close modal/fullscreen popups before other actions
3) Call the LLM (structured outputs enabled by default for Ollama).
4) Validate the action against `schemas/action.schema.json`.
5) Execute the returned action.
6) Repeat until `extract` or `done`.

## Extending

- Add new action types by extending `performAction` in `src/browser.js` and updating the tool schema in `src/index.js`.
- Add new LLM providers by extending `src/llm.js`.
- Update `schemas/action.schema.json` if the action contract changes.
