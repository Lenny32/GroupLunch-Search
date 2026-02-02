import argparse
import os
from datetime import datetime
from typing import List, Optional

from .agent import LLMActionAgent
from .browser import ActionRunner
from .config import load_config
from .llm import build_client


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="LLM-driven Chromium runner")
    parser.add_argument("--task", help="Task text for the agent.")
    parser.add_argument("--task-file", help="Path to a text file with the task.")
    parser.add_argument("--config", help="Path to a JSONC config file.")
    parser.add_argument("--provider", default=os.getenv("LLM_PROVIDER", "ollama"))
    parser.add_argument("--output-dir", default=None)
    parser.add_argument("--max-steps", type=int, default=12)
    parser.add_argument("--show-browser", action="store_true", default=False)
    parser.add_argument("--allowed-hosts", default="")
    return parser.parse_args()


def _load_task(args: argparse.Namespace) -> str:
    if args.config:
        return ""
    if args.task:
        return args.task
    if args.task_file:
        with open(args.task_file, "r", encoding="utf-8") as handle:
            return handle.read().strip()
    raise ValueError("Provide --task or --task-file")


def _parse_allowed_hosts(raw: str) -> Optional[List[str]]:
    hosts = [h.strip() for h in raw.split(",") if h.strip()]
    return hosts or None


def main() -> None:
    args = _parse_args()
    config = load_config(args.config) if args.config else None
    task = config.goal if config else _load_task(args)
    output_dir = args.output_dir or os.path.join(
        "runs", datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    )
    headless = not args.show_browser

    provider = config.provider if config else args.provider
    model = config.model if config else None
    deployment = config.deployment if config else None
    base_url = config.base_url if config else None
    client = build_client(provider, model=model, deployment=deployment, base_url=base_url)
    agent = LLMActionAgent(client, instructions=(config.instructions if config else ""))
    runner = ActionRunner(agent, headless=headless)

    result = runner.run_loop(
        task=task,
        output_dir=output_dir,
        max_steps=(config.max_depth if config else args.max_steps),
        allowed_hosts=_parse_allowed_hosts(args.allowed_hosts),
    )

    print(f"Saved screenshots: {len(result.screenshots)}")
    print(f"Extractions: {len(result.extractions)}")


if __name__ == "__main__":
    main()
