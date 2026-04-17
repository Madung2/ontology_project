"""Ollama/Gemma4 REST API client."""

import json
import httpx
from pydantic import BaseModel


class SLMConfig(BaseModel):
    """Configuration for the SLM (Small Language Model) client."""
    base_url: str = "http://localhost:11434"
    model: str = "gemma3:4b"
    model_heavy: str = "gemma3:27b"
    temperature: float = 0.1
    timeout: int = 30


class SLMClient:
    """Client for Ollama/Gemma4 REST API."""

    def __init__(self, config: SLMConfig = None):
        """Initialize with configuration."""
        self.config = config or SLMConfig()

    async def generate(self, prompt: str, json_mode: bool = False) -> str:
        """Generate text using the default model."""
        return await self._generate(self.config.model, prompt, json_mode)

    async def generate_heavy(self, prompt: str, json_mode: bool = False) -> str:
        """Generate text using the heavy model."""
        return await self._generate(self.config.model_heavy, prompt, json_mode)

    async def _generate(self, model: str, prompt: str, json_mode: bool = False) -> str:
        """Internal method to generate text."""
        try:
            async with httpx.AsyncClient(timeout=self.config.timeout) as client:
                response = await client.post(
                    f"{self.config.base_url}/api/generate",
                    json={
                        "model": model,
                        "prompt": prompt,
                        "temperature": self.config.temperature,
                        "stream": False,
                    },
                )
                response.raise_for_status()
                data = response.json()
                return data.get("response", "")
        except Exception:
            # Fallback to mock response
            return self._mock_response(prompt, json_mode)

    async def is_available(self) -> bool:
        """Check if Ollama is available."""
        try:
            async with httpx.AsyncClient(timeout=5) as client:
                response = await client.get(f"{self.config.base_url}/api/tags")
                response.raise_for_status()
                return True
        except Exception:
            return False

    def _mock_response(self, prompt: str, json_mode: bool = False) -> str:
        """Return a sensible mock response when Ollama is unavailable."""
        if json_mode:
            # Return empty JSON structure
            if "classification" in prompt.lower():
                return json.dumps({
                    "classification": "ENTITY",
                    "confidence": 0.5,
                    "reasoning": "Mock response - Ollama unavailable"
                })
            elif "domain" in prompt.lower():
                return json.dumps({
                    "domain": "generic",
                    "confidence": 0.5,
                    "reasoning": "Mock response - Ollama unavailable"
                })
            else:
                return json.dumps({"response": "Mock response - Ollama unavailable"})
        else:
            return "Mock response - Ollama unavailable. Please ensure Ollama is running."
