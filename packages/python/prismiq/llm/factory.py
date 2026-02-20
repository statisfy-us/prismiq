"""Factory function for creating LLM providers."""

from __future__ import annotations

from prismiq.llm.provider import LLMProvider
from prismiq.llm.types import LLMConfig, LLMProviderType


def create_provider(config: LLMConfig) -> LLMProvider:
    """Create an LLM provider based on the configuration.

    Args:
        config: LLM configuration specifying provider type and credentials.

    Returns:
        An initialized LLMProvider instance.

    Raises:
        ValueError: If the provider type is not supported.
        ImportError: If the required SDK is not installed.
    """
    match config.provider:
        case LLMProviderType.GEMINI:
            from prismiq.llm.gemini import GeminiProvider

            return GeminiProvider(config)
        case LLMProviderType.OPENAI:
            raise ValueError(
                "OpenAI provider not yet implemented. "
                "Contributions welcome at https://github.com/statisfy-us/prismiq"
            )
        case LLMProviderType.ANTHROPIC:
            raise ValueError(
                "Anthropic provider not yet implemented. "
                "Contributions welcome at https://github.com/statisfy-us/prismiq"
            )
        case _:
            raise ValueError(f"Unknown LLM provider: {config.provider}")
