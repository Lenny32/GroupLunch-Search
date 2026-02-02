from typing import Dict, List

from .actions import parse_actions
from .llm.base import LLMClient

ACTION_SCHEMA = """
Return ONLY valid JSON with this shape:
{
  "actions": [
    {"type": "goto", "url": "https://..."},
    {"type": "click", "selector": "css"},
    {"type": "fill", "selector": "css", "text": "..."},
    {"type": "press", "selector": "css", "key": "Enter"},
    {"type": "wait", "ms": 1000},
    {"type": "scroll", "direction": "down", "pixels": 800},
    {"type": "extract", "selector": "css", "name": "label"},
    {"type": "screenshot", "name": "step"}
  ]
}
"""


class LLMActionAgent:
    def __init__(self, client: LLMClient, instructions: str = ""):
        self.client = client
        self.instructions = instructions

    def next_actions(self, task: str, state: Dict, history: List[Dict]) -> List[Dict]:
        messages = self._build_messages(task, state, history)
        raw = self.client.chat(messages)
        parsed = parse_actions(raw)
        if parsed.error:
            return [
                {
                    "type": "wait",
                    "ms": 1000,
                }
            ]
        return parsed.actions

    def _build_messages(self, task: str, state: Dict, history: List[Dict]) -> List[Dict[str, str]]:
        history_text = "\n".join(
            f"{i+1}. {item.get('type')} {item}" for i, item in enumerate(history[-10:])
        )
        state_text = state.get("text", "")
        links = state.get("links", [])
        links_text = "\n".join(f"- {l['text']} -> {l['href']}" for l in links)
        system = (
            "You control a browser. Use the actions to navigate, scroll, and extract. "
            "Always respond with JSON only. Avoid leaving the site unless necessary. "
            "Take small steps and extract data once found."
        )
        if self.instructions:
            system = f"{system}\n\nExtra instructions:\n{self.instructions}"
        user = (
            f"Task: {task}\n\n"
            f"Current URL: {state.get('url')}\n"
            f"Title: {state.get('title')}\n\n"
            f"Page Text (truncated):\n{state_text}\n\n"
            f"Visible Links:\n{links_text}\n\n"
            f"Recent Actions:\n{history_text}\n\n"
            f"Schema:\n{ACTION_SCHEMA}"
        )
        return [
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ]
