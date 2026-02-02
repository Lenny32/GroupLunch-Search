from typing import Optional

from .base import LLMClient
from .ollama import from_env as ollama_from_env
from .azure_openai import from_env as azure_from_env


def build_client(
    provider: str,
    model: str | None = None,
    deployment: str | None = None,
    base_url: str | None = None,
) -> LLMClient:
    provider = (provider or "").lower()
    if provider == "ollama":
        return ollama_from_env(model_override=model, base_url_override=base_url)
    if provider in ("azure", "azure-openai", "azure_openai"):
        deployment_name = deployment or model
        return azure_from_env(deployment_override=deployment_name)
    raise ValueError(f"Unsupported provider: {provider}")
