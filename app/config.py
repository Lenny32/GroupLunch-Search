import json
from dataclasses import dataclass
from typing import Optional


@dataclass
class AppConfig:
    provider: str
    goal: str
    instructions: str
    max_depth: int
    model: Optional[str]
    deployment: Optional[str]
    base_url: Optional[str]


def _strip_json_comments(text: str) -> str:
    result = []
    i = 0
    in_str = False
    escape = False
    in_line_comment = False
    in_block_comment = False

    while i < len(text):
        ch = text[i]
        nxt = text[i + 1] if i + 1 < len(text) else ""

        if in_line_comment:
            if ch == "\n":
                in_line_comment = False
                result.append(ch)
            i += 1
            continue

        if in_block_comment:
            if ch == "*" and nxt == "/":
                in_block_comment = False
                i += 2
            else:
                i += 1
            continue

        if in_str:
            result.append(ch)
            if escape:
                escape = False
            elif ch == "\\":
                escape = True
            elif ch == '"':
                in_str = False
            i += 1
            continue

        if ch == '"':
            in_str = True
            result.append(ch)
            i += 1
            continue

        if ch == "/" and nxt == "/":
            in_line_comment = True
            i += 2
            continue

        if ch == "/" and nxt == "*":
            in_block_comment = True
            i += 2
            continue

        result.append(ch)
        i += 1

    return "".join(result)


def load_config(path: str) -> AppConfig:
    with open(path, "r", encoding="utf-8") as handle:
        raw = handle.read()
    payload = json.loads(_strip_json_comments(raw))

    llm = payload.get("llm", {})
    provider = llm.get("provider") or payload.get("provider")
    goal = payload.get("goal") or payload.get("task")
    instructions = payload.get("instructions", "")
    max_depth = int(payload.get("max_depth", payload.get("max_steps", 12)))
    model = llm.get("model") or payload.get("model")
    deployment = llm.get("deployment") or payload.get("deployment")
    base_url = llm.get("base_url") or payload.get("base_url")

    if not provider:
        raise ValueError("Config must include llm.provider or provider")
    if not goal:
        raise ValueError("Config must include goal")

    return AppConfig(
        provider=provider,
        goal=goal,
        instructions=instructions,
        max_depth=max_depth,
        model=model,
        deployment=deployment,
        base_url=base_url,
    )
