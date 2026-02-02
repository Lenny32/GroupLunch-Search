# Agent Instructions

Project: GroupLunch-Search

- Primary language: Python 3.11+.
- Browser automation: Playwright (Chromium).
- LLM providers: Ollama (local) and Azure OpenAI (cloud), configurable via env/CLI.
- Favor small, composable modules; keep side effects in `app/main.py`.
- Tests: `pytest` under `tests/`. Avoid external network in tests; prefer local fixtures.
- Formatting: standard PEP8; keep files ASCII-only unless necessary.
- Always validate work before responding: build Docker image, run a functional check, then remove the image. Do not finish a task without attempting this checklist.

Common commands:
- Create venv: `python -m venv .venv`
- Activate venv (PowerShell): `.\.venv\Scripts\Activate.ps1`
- Install deps: `python -m pip install -r requirements.txt`
- Install browser: `python -m playwright install chromium`
- Run app: `python -m app.main --task "..."`
- Run tests: `python -m pytest`

Post-work checklist (do after EACH task):
- Build Docker image: `docker build -t group-lunch-search .`
- Functional check: run a basic command (task or config)
- Remove image: `docker rmi group-lunch-search`
