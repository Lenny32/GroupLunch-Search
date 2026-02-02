import os
from typing import List, Dict, Optional
from urllib.parse import urlparse, urlunparse

import requests

from .base import LLMClient


def _in_docker() -> bool:
    if os.path.exists("/.dockerenv"):
        return True
    cgroup_path = "/proc/1/cgroup"
    if os.path.exists(cgroup_path):
        try:
            with open(cgroup_path, "r", encoding="utf-8") as handle:
                data = handle.read()
            return "docker" in data or "containerd" in data
        except OSError:
            return False
    return False


def _normalize_base_url(base_url: str, in_docker: Optional[bool] = None) -> str:
    if not base_url:
        return base_url
    in_docker = _in_docker() if in_docker is None else in_docker
    parsed = urlparse(base_url)
    host = parsed.hostname or ""
    if in_docker and host in ("127.0.0.1", "localhost"):
        netloc = "host.docker.internal"
        if parsed.port:
            netloc = f"{netloc}:{parsed.port}"
        parsed = parsed._replace(netloc=netloc)
        return urlunparse(parsed)
    return base_url


def _messages_to_prompt(messages: List[Dict[str, str]]) -> str:
    lines = []
    for msg in messages:
        role = msg.get("role", "user")
        content = msg.get("content", "")
        lines.append(f"{role}: {content}")
    return "\n".join(lines)


class OllamaClient(LLMClient):
    def __init__(self, base_url: str, model: Optional[str], timeout_s: int = 120):
        self.base_url = _normalize_base_url(base_url).rstrip("/")
        self.model = model
        self.timeout_s = timeout_s
        self._model_resolved = False

    def chat(self, messages: List[Dict[str, str]]) -> str:
        if not self.model and not self._model_resolved:
            self.model = self._resolve_default_model()
            self._model_resolved = True
        if not self.model:
            raise ValueError("No Ollama model specified and none detected.")

        payload = {
            "model": self.model,
            "messages": messages,
            "stream": False,
        }
        chat_url = f"{self.base_url}/api/chat"
        resp = requests.post(chat_url, json=payload, timeout=self.timeout_s)
        if resp.status_code == 404:
            generate_url = f"{self.base_url}/api/generate"
            gen_payload = {
                "model": self.model,
                "prompt": _messages_to_prompt(messages),
                "stream": False,
            }
            gen_resp = requests.post(
                generate_url, json=gen_payload, timeout=self.timeout_s
            )
            if gen_resp.status_code == 404:
                self._raise_model_error_if_present(gen_resp)
            gen_resp.raise_for_status()
            data = gen_resp.json()
            return data.get("response", "")

        if resp.status_code == 404:
            self._raise_model_error_if_present(resp)
        resp.raise_for_status()
        data = resp.json()
        return data.get("message", {}).get("content", "")

    def _resolve_default_model(self) -> Optional[str]:
        tags_url = f"{self.base_url}/api/tags"
        try:
            resp = requests.get(tags_url, timeout=self.timeout_s)
            resp.raise_for_status()
            data = resp.json()
            models = data.get("models", [])
            if models:
                return models[0].get("name")
        except requests.RequestException:
            return None
        return None

    def _raise_model_error_if_present(self, resp: requests.Response) -> None:
        try:
            data = resp.json()
        except ValueError:
            return
        error = str(data.get("error", "")).lower()
        if "model" in error and "not found" in error:
            available = self._resolve_default_model()
            hint = "Set OLLAMA_MODEL or config llm.model to an installed model."
            if available:
                hint = f"{hint} Example: {available}"
            raise ValueError(hint) from None


def from_env(
    model_override: str | None = None, base_url_override: str | None = None
) -> OllamaClient:
    base_url = base_url_override or os.getenv(
        "OLLAMA_BASE_URL", "http://localhost:11434"
    )
    model = model_override or os.getenv("OLLAMA_MODEL")
    timeout_s = int(os.getenv("OLLAMA_TIMEOUT_S", "120"))
    return OllamaClient(base_url=base_url, model=model, timeout_s=timeout_s)
