"""Tests for the LLM agent loop."""

from __future__ import annotations

from collections.abc import AsyncIterator, Callable, Coroutine
from typing import Any
from unittest.mock import AsyncMock, MagicMock

import pytest

from prismiq.llm.agent import DEFAULT_MAX_TOOL_ITERATIONS, _extract_sql_blocks, run_agent_stream
from prismiq.llm.types import (
    ChatMessage,
    ChatRole,
    StreamChunk,
    StreamChunkType,
    ToolDefinition,
)
from prismiq.sql_validator import SQLValidationResult
from prismiq.types import (
    ColumnSchema,
    DatabaseSchema,
    TableSchema,
)

# ============================================================================
# SQL Extraction Tests
# ============================================================================


class TestExtractSqlBlocks:
    """Tests for _extract_sql_blocks."""

    def test_single_block(self) -> None:
        text = "Here's the query:\n```sql\nSELECT * FROM users\n```"
        assert _extract_sql_blocks(text) == ["SELECT * FROM users"]

    def test_multiple_blocks(self) -> None:
        text = "First:\n```sql\nSELECT 1\n```\nSecond:\n```sql\nSELECT 2\n```"
        result = _extract_sql_blocks(text)
        assert len(result) == 2
        assert result[0] == "SELECT 1"
        assert result[1] == "SELECT 2"

    def test_no_blocks(self) -> None:
        text = "No SQL here, just plain text."
        assert _extract_sql_blocks(text) == []

    def test_multiline_sql(self) -> None:
        text = "```sql\nSELECT\n  name,\n  age\nFROM users\nWHERE age > 21\n```"
        result = _extract_sql_blocks(text)
        assert len(result) == 1
        assert "SELECT" in result[0]
        assert "WHERE age > 21" in result[0]

    def test_empty_block_ignored(self) -> None:
        text = "```sql\n\n```"
        assert _extract_sql_blocks(text) == []

    def test_non_sql_code_blocks_ignored(self) -> None:
        text = "```python\nprint('hello')\n```\n```sql\nSELECT 1\n```"
        result = _extract_sql_blocks(text)
        assert len(result) == 1
        assert result[0] == "SELECT 1"


# ============================================================================
# Agent Stream Tests
# ============================================================================


@pytest.fixture
def mock_schema() -> DatabaseSchema:
    """Create a simple mock schema for testing."""
    return DatabaseSchema(
        tables=[
            TableSchema(
                name="users",
                schema_name="public",
                columns=[
                    ColumnSchema(name="id", data_type="integer", is_nullable=False),
                    ColumnSchema(name="name", data_type="text", is_nullable=False),
                ],
            ),
        ],
        relationships=[],
    )


@pytest.fixture
def mock_engine(mock_schema: DatabaseSchema) -> MagicMock:
    """Create a mock PrismiqEngine."""
    engine = MagicMock()
    engine.get_schema = AsyncMock(return_value=mock_schema)
    engine.validate_sql = AsyncMock(
        return_value=SQLValidationResult(
            valid=True, errors=[], tables=["users"], sanitized_sql='SELECT * FROM "users"'
        )
    )
    return engine


def make_provider(
    loop_fn: Callable[..., AsyncIterator[StreamChunk]],
) -> MagicMock:
    """Create a mock provider with a custom run_chat_loop."""
    provider = MagicMock()
    provider.run_chat_loop = loop_fn
    return provider


class TestRunAgentStream:
    """Tests for run_agent_stream."""

    @pytest.mark.asyncio
    async def test_simple_text_response(self, mock_engine: MagicMock) -> None:
        """Test a simple response without tool calls."""

        async def mock_loop(
            messages: list[ChatMessage],
            tools: list[ToolDefinition] | None = None,
            execute_tool_fn: Callable[..., Coroutine[Any, Any, str]] | None = None,
            max_iterations: int = 5,
        ) -> AsyncIterator[StreamChunk]:
            yield StreamChunk(type=StreamChunkType.TEXT, content="Here is your query:\n")
            yield StreamChunk(type=StreamChunkType.TEXT, content="```sql\nSELECT * FROM users\n```")

        provider = make_provider(mock_loop)

        chunks = []
        async for chunk in run_agent_stream(provider, mock_engine, "Show me all users", []):
            chunks.append(chunk)

        text_chunks = [c for c in chunks if c.type == StreamChunkType.TEXT]
        sql_chunks = [c for c in chunks if c.type == StreamChunkType.SQL]
        done_chunks = [c for c in chunks if c.type == StreamChunkType.DONE]

        assert len(text_chunks) == 2
        assert len(sql_chunks) == 1
        assert sql_chunks[0].content == "SELECT * FROM users"
        assert len(done_chunks) == 1

    @pytest.mark.asyncio
    async def test_tool_call_and_response(self, mock_engine: MagicMock) -> None:
        """Test that tool calls are executed via the provider loop."""

        async def mock_loop(
            messages: list[ChatMessage],
            tools: list[ToolDefinition] | None = None,
            execute_tool_fn: Callable[..., Coroutine[Any, Any, str]] | None = None,
            max_iterations: int = 5,
        ) -> AsyncIterator[StreamChunk]:
            # Simulate: tool call -> execute -> text response
            yield StreamChunk(
                type=StreamChunkType.TOOL_CALL,
                tool_name="get_schema_overview",
                tool_args={},
            )

            # Execute the tool
            result = ""
            if execute_tool_fn:
                result = await execute_tool_fn("get_schema_overview", {})

            yield StreamChunk(
                type=StreamChunkType.TOOL_RESULT,
                content=result,
                tool_name="get_schema_overview",
            )

            yield StreamChunk(
                type=StreamChunkType.TEXT,
                content="```sql\nSELECT * FROM users\n```",
            )

        provider = make_provider(mock_loop)

        chunks = []
        async for chunk in run_agent_stream(provider, mock_engine, "What tables exist?", []):
            chunks.append(chunk)

        tool_call_chunks = [c for c in chunks if c.type == StreamChunkType.TOOL_CALL]
        tool_result_chunks = [c for c in chunks if c.type == StreamChunkType.TOOL_RESULT]

        assert len(tool_call_chunks) == 1
        assert tool_call_chunks[0].tool_name == "get_schema_overview"
        assert len(tool_result_chunks) == 1
        assert "users" in tool_result_chunks[0].content

    @pytest.mark.asyncio
    async def test_error_stops_stream(self, mock_engine: MagicMock) -> None:
        """Test that an error chunk stops the agent loop."""

        async def mock_loop(
            messages: list[ChatMessage],
            tools: list[ToolDefinition] | None = None,
            execute_tool_fn: Callable[..., Coroutine[Any, Any, str]] | None = None,
            max_iterations: int = 5,
        ) -> AsyncIterator[StreamChunk]:
            yield StreamChunk(type=StreamChunkType.TEXT, content="Starting...")
            yield StreamChunk(type=StreamChunkType.ERROR, content="Provider error")

        provider = make_provider(mock_loop)

        chunks = []
        async for chunk in run_agent_stream(provider, mock_engine, "Hello", []):
            chunks.append(chunk)

        error_chunks = [c for c in chunks if c.type == StreamChunkType.ERROR]
        assert len(error_chunks) == 1

    @pytest.mark.asyncio
    async def test_max_iterations_text(self, mock_engine: MagicMock) -> None:
        """Test that max iterations message is passed through."""

        async def mock_loop(
            messages: list[ChatMessage],
            tools: list[ToolDefinition] | None = None,
            execute_tool_fn: Callable[..., Coroutine[Any, Any, str]] | None = None,
            max_iterations: int = 5,
        ) -> AsyncIterator[StreamChunk]:
            # Simulate hitting max iterations
            for _i in range(max_iterations):
                yield StreamChunk(
                    type=StreamChunkType.TOOL_CALL,
                    tool_name="get_schema_overview",
                    tool_args={},
                )
                yield StreamChunk(
                    type=StreamChunkType.TOOL_RESULT,
                    content="tables: users",
                    tool_name="get_schema_overview",
                )
            yield StreamChunk(
                type=StreamChunkType.TEXT,
                content="\n\n(Reached maximum tool iterations. Please refine your question.)",
            )

        provider = make_provider(mock_loop)

        chunks = []
        async for chunk in run_agent_stream(provider, mock_engine, "Keep calling tools", []):
            chunks.append(chunk)

        tool_calls = [c for c in chunks if c.type == StreamChunkType.TOOL_CALL]
        assert len(tool_calls) == DEFAULT_MAX_TOOL_ITERATIONS

        text_chunks = [c for c in chunks if c.type == StreamChunkType.TEXT]
        assert any("maximum tool iterations" in c.content.lower() for c in text_chunks)

    @pytest.mark.asyncio
    async def test_current_sql_context(self, mock_engine: MagicMock) -> None:
        """Test that current SQL is appended to the user message."""
        captured_messages: list[ChatMessage] = []

        async def mock_loop(
            messages: list[ChatMessage],
            tools: list[ToolDefinition] | None = None,
            execute_tool_fn: Callable[..., Coroutine[Any, Any, str]] | None = None,
            max_iterations: int = 5,
        ) -> AsyncIterator[StreamChunk]:
            captured_messages.extend(messages)
            yield StreamChunk(type=StreamChunkType.TEXT, content="OK")

        provider = make_provider(mock_loop)

        chunks = []
        async for chunk in run_agent_stream(
            provider,
            mock_engine,
            "Fix this query",
            [],
            current_sql="SELECT * FROM foo",
        ):
            chunks.append(chunk)

        user_messages = [m for m in captured_messages if m.role == ChatRole.USER]
        assert len(user_messages) == 1
        assert "SELECT * FROM foo" in user_messages[0].content

    @pytest.mark.asyncio
    async def test_history_preserved(self, mock_engine: MagicMock) -> None:
        """Test that conversation history is included in messages."""
        captured_messages: list[ChatMessage] = []

        async def mock_loop(
            messages: list[ChatMessage],
            tools: list[ToolDefinition] | None = None,
            execute_tool_fn: Callable[..., Coroutine[Any, Any, str]] | None = None,
            max_iterations: int = 5,
        ) -> AsyncIterator[StreamChunk]:
            captured_messages.extend(messages)
            yield StreamChunk(type=StreamChunkType.TEXT, content="OK")

        provider = make_provider(mock_loop)

        history = [
            ChatMessage(role=ChatRole.USER, content="What tables exist?"),
            ChatMessage(role=ChatRole.ASSISTANT, content="There's a users table."),
        ]

        chunks = []
        async for chunk in run_agent_stream(provider, mock_engine, "Show me the columns", history):
            chunks.append(chunk)

        assert len(captured_messages) >= 4  # system + 2 history + new user
        assert captured_messages[1].content == "What tables exist?"
        assert captured_messages[2].content == "There's a users table."
