# GroupLunch-Search

LLM-driven Chromium runner using Playwright. Supports Ollama locally and Azure OpenAI in the cloud. The LLM controls clicks, scrolling, and extraction through a JSON action protocol.

## Quick start

1) Install dependencies

```
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
python -m pip install -r requirements-dev.txt
python -m playwright install chromium
```

2) Configure LLM

### Ollama (local)

```
set OLLAMA_MODEL=llama3.1
set OLLAMA_BASE_URL=http://localhost:11434
```

### Azure OpenAI (cloud)

```
set AZURE_OPENAI_ENDPOINT=https://YOUR_RESOURCE.openai.azure.com
set AZURE_OPENAI_API_KEY=YOUR_KEY
set AZURE_OPENAI_DEPLOYMENT=YOUR_DEPLOYMENT
set AZURE_OPENAI_API_VERSION=2024-06-01
```

3) Run

```
python -m app.main --task "Find the pricing page and extract the plan names" --provider ollama
```

Screenshots and extractions are saved under `runs/`.

Enable debug logging:

```
set LOG_LEVEL=DEBUG
```

## Start

Run with a task:

```
python -m app.main --task "Find the pricing page and extract the plan names" --provider ollama
```

Run with config:

```
python -m app.main --config config.example.jsonc
```

## Local test website (5 pages)

Start the local mock site (Windows/macOS/Linux):

```
python scripts/serve_site5.py --port 8000
```

Open in a browser:

```
http://127.0.0.1:8000/index.html
```

Run the Docker image against the mock site (Windows/macOS):

```
docker run --rm -e LLM_PROVIDER=ollama -e OLLAMA_BASE_URL=http://host.docker.internal:11434 \
  group-lunch-search --task "Open http://host.docker.internal:8000/index.html and extract the lunch menu items"
```

Linux Docker:

```
docker run --rm --add-host=host.docker.internal:host-gateway \
  -e LLM_PROVIDER=ollama -e OLLAMA_BASE_URL=http://host.docker.internal:11434 \
  group-lunch-search --task "Open http://host.docker.internal:8000/index.html and extract the lunch menu items"
```

Replace the `OLLAMA_BASE_URL` with your reachable Ollama URL if it differs (for example, a LAN IP).

## Config file (JSON with comments)

Use a JSONC config file to set the provider, instructions, max depth, and goal:

```
python -m app.main --config config.example.jsonc
```

For Ollama, set `llm.model` in the config to choose the model. For Azure OpenAI, use
`llm.deployment` (or `llm.model` as an alias) to select the deployment name.
For Ollama on another machine, set `llm.base_url` to the reachable URL.
If `llm.model` is omitted, the app will try to pick the first installed model from Ollama.
Set `headless` to `false` to show the browser for debugging.

## Docker (Option A)

Build:

```
docker build -t group-lunch-search .
```

Run (use Ollama on host):

```
docker run --rm -e LLM_PROVIDER=ollama -e OLLAMA_BASE_URL=http://host.docker.internal:11434 group-lunch-search \
  --task "Find the help page and extract the main title"
```

Inside Docker, if you set `OLLAMA_BASE_URL` to `http://127.0.0.1:11434` or `http://localhost:11434`,
the app will automatically rewrite it to `http://host.docker.internal:11434`.

If you use Linux Docker, add a host mapping and keep the same URL:

```
docker run --rm --add-host=host.docker.internal:host-gateway \
  -e LLM_PROVIDER=ollama -e OLLAMA_BASE_URL=http://host.docker.internal:11434 \
  group-lunch-search --task "Find the help page and extract the main title"
```

Using `127.0.0.1` inside the container points to the container itself, not your host.

## Action protocol

The LLM must return JSON only:

```json
{
  "actions": [
    {"type": "goto", "url": "https://example.com"},
    {"type": "click", "selector": "a[href*='pricing']"},
    {"type": "scroll", "direction": "down", "pixels": 900},
    {"type": "extract", "selector": "main", "name": "main_content"}
  ]
}
```

## Tests

```
python -m pytest
```

The integration test uses a local HTML fixture; no external network required.

## Post-work checklist

After each change:

```
docker build -t group-lunch-search .
docker run --rm group-lunch-search --help
docker rmi group-lunch-search
```
