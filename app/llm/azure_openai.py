import logging
import os
from typing import List, Dict

import requests

from .base import LLMClient

logger = logging.getLogger(__name__)

class AzureOpenAIClient(LLMClient):
    def __init__(
        self,
        endpoint: str,
        api_key: str,
        deployment: str,
        api_version: str,
        timeout_s: int = 120,
    ):
        self.endpoint = endpoint.rstrip("/")
        self.api_key = api_key
        self.deployment = deployment
        self.api_version = api_version
        self.timeout_s = timeout_s

    def chat(self, messages: List[Dict[str, str]]) -> str:
        url = (
            f"{self.endpoint}/openai/deployments/{self.deployment}/"
            f"chat/completions?api-version={self.api_version}"
        )
        headers = {
            "api-key": self.api_key,
            "Content-Type": "application/json",
        }
        payload = {
            "messages": messages,
            "temperature": 0,
        }
        logger.debug("Azure OpenAI request deployment=%s api_version=%s", self.deployment, self.api_version)
        resp = requests.post(url, headers=headers, json=payload, timeout=self.timeout_s)
        resp.raise_for_status()
        data = resp.json()
        return data.get("choices", [{}])[0].get("message", {}).get("content", "")


def from_env(deployment_override: str | None = None) -> AzureOpenAIClient:
    endpoint = os.environ["AZURE_OPENAI_ENDPOINT"]
    api_key = os.environ["AZURE_OPENAI_API_KEY"]
    deployment = deployment_override or os.environ["AZURE_OPENAI_DEPLOYMENT"]
    api_version = os.getenv("AZURE_OPENAI_API_VERSION", "2024-06-01")
    timeout_s = int(os.getenv("AZURE_OPENAI_TIMEOUT_S", "120"))
    return AzureOpenAIClient(
        endpoint=endpoint,
        api_key=api_key,
        deployment=deployment,
        api_version=api_version,
        timeout_s=timeout_s,
    )
