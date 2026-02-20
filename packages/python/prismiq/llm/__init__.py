"""LLM subsystem for Prismiq.

Provides an optional LLM-powered chat agent that helps users
build SQL queries using natural language. The agent has access
to schema introspection tools and streams responses via SSE.

This module is optional — install with: pip install prismiq[llm]
"""

from __future__ import annotations

from prismiq.llm.types import (
    ChatMessage,
    ChatRequest,
    ChatRole,
    LLMConfig,
    LLMProviderType,
    StreamChunk,
    StreamChunkType,
    ToolCallRequest,
    ToolDefinition,
    WidgetContext,
)

__all__ = [
    "ChatMessage",
    "ChatRequest",
    "ChatRole",
    "LLMConfig",
    "LLMProviderType",
    "StreamChunk",
    "StreamChunkType",
    "ToolCallRequest",
    "ToolDefinition",
    "WidgetContext",
]
