"""Agent loop for the LLM chat.

Orchestrates the conversation between the user, the LLM provider,
and the available tools. Streams chunks back to the caller.
"""

from __future__ import annotations

import logging
import re
from collections.abc import AsyncIterator
from typing import TYPE_CHECKING, Any

from prismiq.llm.prompt import build_system_prompt
from prismiq.llm.tools import ALL_TOOLS, execute_tool
from prismiq.llm.types import (
    ChatMessage,
    ChatRole,
    StreamChunk,
    StreamChunkType,
    WidgetContext,
)

if TYPE_CHECKING:
    from prismiq.engine import PrismiqEngine
    from prismiq.llm.provider import LLMProvider

_logger = logging.getLogger(__name__)

DEFAULT_MAX_TOOL_ITERATIONS = 10

# Human-readable status messages for each tool
_TOOL_STATUS_MESSAGES: dict[str, str] = {
    "get_schema_overview": "Exploring available tables...",
    "get_table_details": "Inspecting table details...",
    "get_column_values": "Looking up column values...",
    "get_relationships": "Checking table relationships...",
    "validate_sql": "Validating SQL syntax...",
    "execute_sql": "Executing query...",
}


async def run_agent_stream(
    provider: LLMProvider,
    engine: PrismiqEngine,
    user_message: str,
    history: list[ChatMessage],
    current_sql: str | None = None,
    schema_name: str | None = None,
    widget_context: WidgetContext | None = None,
    max_tool_iterations: int | None = None,
) -> AsyncIterator[StreamChunk]:
    """Run the agent loop and stream response chunks.

    Delegates the multi-turn tool loop to the provider's run_chat_loop,
    which handles provider-specific concerns (e.g., thought_signature
    preservation for Gemini 3 models).

    Args:
        provider: LLM provider to use for generation.
        engine: PrismiqEngine for tool execution.
        user_message: The user's current message.
        history: Previous conversation messages.
        current_sql: Current SQL in the editor (for context).
        schema_name: PostgreSQL schema for multi-tenant queries.
        widget_context: Optional context about the target widget type.

    Yields:
        StreamChunk objects for the frontend to consume.
    """
    # Status: inspecting schema
    yield StreamChunk(type=StreamChunkType.STATUS, content="Inspecting database schema...")

    # Build system prompt with schema context
    schema = await engine.get_schema(schema_name=schema_name)
    system_prompt = build_system_prompt(schema, widget_context)

    # Build message list
    messages: list[ChatMessage] = [
        ChatMessage(role=ChatRole.SYSTEM, content=system_prompt),
    ]

    # Add conversation history
    messages.extend(history)

    # Add current SQL context if available
    user_content = user_message
    if current_sql:
        user_content = f"{user_message}\n\n[Current SQL in editor:\n```sql\n{current_sql}\n```]"

    messages.append(ChatMessage(role=ChatRole.USER, content=user_content))

    # Create tool executor bound to the engine
    async def tool_executor(name: str, arguments: dict[str, Any]) -> str:
        _logger.info("Executing tool: %s (keys: %s)", name, list(arguments.keys()))
        return await execute_tool(
            name, arguments, engine, schema_name=schema_name, widget_context=widget_context
        )

    # Run the provider's chat loop (handles tool calls + provider-specific quirks)
    accumulated_text = ""
    async for chunk in provider.run_chat_loop(
        messages=messages,
        tools=ALL_TOOLS,
        execute_tool_fn=tool_executor,
        max_iterations=max_tool_iterations
        if max_tool_iterations is not None
        else DEFAULT_MAX_TOOL_ITERATIONS,
    ):
        # Emit status messages before tool calls
        if chunk.type == StreamChunkType.TOOL_CALL and chunk.tool_name:
            status_msg = _TOOL_STATUS_MESSAGES.get(chunk.tool_name)
            if status_msg:
                yield StreamChunk(type=StreamChunkType.STATUS, content=status_msg)

        if chunk.type == StreamChunkType.TEXT:
            accumulated_text += chunk.content
        yield chunk

    # Status: preparing response
    yield StreamChunk(type=StreamChunkType.STATUS, content="Preparing response...")

    # Extract SQL from accumulated text and yield as SQL chunks
    sql_blocks = _extract_sql_blocks(accumulated_text)
    for sql in sql_blocks:
        yield StreamChunk(type=StreamChunkType.SQL, content=sql)

    yield StreamChunk(type=StreamChunkType.DONE)


def _extract_sql_blocks(text: str) -> list[str]:
    """Extract SQL code blocks from markdown text.

    Looks for ```sql ... ``` blocks and returns the SQL content.
    """
    pattern = r"```sql\s*\n(.*?)\n\s*```"
    matches = re.findall(pattern, text, re.DOTALL)
    return [m.strip() for m in matches if m.strip()]
