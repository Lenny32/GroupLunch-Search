from pathlib import Path

import pytest

from app.browser import ActionRunner


class StaticAgent:
    def __init__(self, actions):
        self.actions = actions
        self._used = False

    def next_actions(self, task, state, history):
        if self._used:
            return [{"type": "wait", "ms": 200}]
        self._used = True
        return self.actions


def test_action_runner_extracts_text(tmp_path: Path):
    html_path = Path(__file__).parent / "fixtures" / "site.html"
    url = html_path.as_uri()

    actions = [
        {"type": "goto", "url": url},
        {"type": "click", "selector": "#reveal"},
        {"type": "wait", "ms": 500},
        {"type": "extract", "selector": "#result", "name": "result"},
        {"type": "screenshot", "name": "final"},
    ]

    agent = StaticAgent(actions)
    runner = ActionRunner(agent, headless=True, screenshot_each_step=False)

    result = runner.run_loop(
        task="Reveal the result text",
        output_dir=str(tmp_path),
        max_steps=2,
    )

    assert any("Result: OK" in item["text"] for item in result.extractions)
    assert (tmp_path / "final.png").exists()
