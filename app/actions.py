import json
from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Tuple

ALLOWED_ACTIONS = {
    "goto",
    "click",
    "fill",
    "press",
    "wait",
    "scroll",
    "extract",
    "screenshot",
}


@dataclass
class ParsedActions:
    actions: List[Dict[str, Any]]
    error: Optional[str] = None


def _find_json_object(text: str) -> Optional[str]:
    start = text.find("{")
    if start == -1:
        return None
    depth = 0
    in_str = False
    escape = False
    for i in range(start, len(text)):
        ch = text[i]
        if in_str:
            if escape:
                escape = False
            elif ch == "\\":
                escape = True
            elif ch == '"':
                in_str = False
        else:
            if ch == '"':
                in_str = True
            elif ch == "{":
                depth += 1
            elif ch == "}":
                depth -= 1
                if depth == 0:
                    return text[start : i + 1]
    return None


def parse_actions(raw_text: str, max_actions: int = 8) -> ParsedActions:
    json_text = _find_json_object(raw_text)
    if not json_text:
        return ParsedActions(actions=[], error="No JSON object found in LLM response.")
    try:
        payload = json.loads(json_text)
    except json.JSONDecodeError as exc:
        return ParsedActions(actions=[], error=f"Invalid JSON: {exc}")

    actions = payload.get("actions")
    if not isinstance(actions, list):
        return ParsedActions(actions=[], error="JSON must contain an 'actions' array.")

    sanitized: List[Dict[str, Any]] = []
    for action in actions[:max_actions]:
        if not isinstance(action, dict):
            return ParsedActions(actions=[], error="Each action must be an object.")
        _normalize_action(action)
        valid, err = _validate_action(action)
        if not valid:
            return ParsedActions(actions=[], error=err)
        sanitized.append(action)

    return ParsedActions(actions=sanitized)


def _validate_action(action: Any) -> Tuple[bool, str]:
    action_type = action.get("type")
    if action_type not in ALLOWED_ACTIONS:
        return False, f"Unsupported action type: {action_type}"

    if action_type == "goto":
        if not action.get("url"):
            return False, "'goto' requires a non-empty 'url'."
    elif action_type == "click":
        if not action.get("selector"):
            return False, "'click' requires a non-empty 'selector'."
    elif action_type == "fill":
        if not action.get("selector") or action.get("text") is None:
            return False, "'fill' requires 'selector' and 'text'."
    elif action_type == "press":
        if not action.get("selector") or not action.get("key"):
            return False, "'press' requires 'selector' and 'key'."
    elif action_type == "wait":
        if action.get("ms") is None:
            return False, "'wait' requires 'ms'."
    elif action_type == "scroll":
        if action.get("direction") not in ("up", "down"):
            return False, "'scroll' requires 'direction' of 'up' or 'down'."
    elif action_type == "extract":
        if not action.get("name"):
            action["name"] = "extract"
    elif action_type == "screenshot":
        if not action.get("name"):
            action["name"] = "screenshot"

    return True, ""


def _normalize_action(action: Dict[str, Any]) -> None:
    action_type = action.get("type")
    value = action.get("value")
    selector = action.get("selector")

    if isinstance(selector, str):
        trimmed = selector.strip()
        lower = trimmed.lower()
        if lower.startswith("css="):
            selector = trimmed[4:].strip()
        elif lower.startswith("css "):
            selector = trimmed[4:].strip()
        action["selector"] = selector

    if action_type in ("click", "fill", "press", "extract"):
        if (not selector or selector == "css") and value:
            action["selector"] = value

    if action_type == "goto":
        if not action.get("url") and value:
            action["url"] = value
