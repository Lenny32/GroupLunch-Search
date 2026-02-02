from typing import List, Dict


class LLMClient:
    def chat(self, messages: List[Dict[str, str]]) -> str:
        raise NotImplementedError
