"""Abstract base class for LLM providers.

Defines the interface that all LLM provider implementations must follow.
"""

from __future__ import annotations

import abc
from collections.abc import AsyncIterator, Callable, Coroutine
from typing import TYPE_CHECKING, Any

from prismiq.llm.types import StreamChunk, StreamChunkType, ToolCallRequest

if TYPE_CHECKING:
    from prismiq.llm.types import ChatMessage, LLMConfig, ToolDefinition


class LLMProvider(abc.ABC):
    """Abstract base class for LLM providers.

    Implementations must handle:
    - Converting messages to provider-specific format
    - Streaming responses as StreamChunk objects
    - Tool/function calling
    """

    def __init__(self, config: LLMConfig) -> None:
        self._config = config

    @property
    def provider_name(self) -> str:
        """Human-readable provider name."""
        return self._config.provider.value

    @property
    def model_name(self) -> str:
        """Model name being used."""
        return self._config.model

    @abc.abstractmethod
    async def stream_chat(
        self,
        messages: list[ChatMessage],
        tools: list[ToolDefinition] | None = None,
    ) -> AsyncIterator[StreamChunk]:
        """Stream a chat response from the LLM.

        Args:
            messages: Conversation history including the latest user message.
            tools: Available tools the LLM can call.

        Yields:
            StreamChunk objects as the response is generated.
        """
        ...
        # yield needed to make this an async generator for type checking
        yield StreamChunk(type=StreamChunkType.DONE)  # pragma: no cover

    async def run_chat_loop(
        self,
        messages: list[ChatMessage],
        tools: list[ToolDefinition] | None = None,
        execute_tool_fn: Callable[[str, dict[str, Any]], Coroutine[Any, Any, str]] | None = None,
        max_iterations: int = 5,
    ) -> AsyncIterator[StreamChunk]:
        """Run a multi-turn tool-calling loop.

        Default implementation uses stream_chat in a loop, reconstructing
        messages from ChatMessage objects. Providers can override this
        to use native SDK types (e.g., to preserve thought_signature
        for Gemini 3 models).

        Args:
            messages: Initial messages including system prompt and user message.
            tools: Available tools.
            execute_tool_fn: Callback to execute a tool: (name, args) -> result.
            max_iterations: Max tool-call rounds.

        Yields:
            StreamChunk objects.
        """
        from prismiq.llm.types import ChatMessage, ChatRole

        current_messages = list(messages)

        for iteration in range(max_iterations):
            accumulated_text = ""
            tool_calls: list[ToolCallRequest] = []

            async for chunk in self.stream_chat(current_messages, tools=tools):
                if chunk.type == StreamChunkType.TEXT:
                    accumulated_text += chunk.content
                    yield chunk
                elif chunk.type == StreamChunkType.TOOL_CALL:
                    tool_calls.append(
                        ToolCallRequest(
                            id=f"call_{iteration}_{len(tool_calls)}",
                            name=chunk.tool_name or "",
                            arguments=chunk.tool_args or {},
                        )
                    )
                    yield chunk
                elif chunk.type == StreamChunkType.ERROR:
                    yield chunk
                    return

            if not tool_calls:
                break

            # Add assistant message with tool calls
            current_messages.append(
                ChatMessage(
                    role=ChatRole.ASSISTANT,
                    content=accumulated_text,
                    tool_calls=tool_calls,
                )
            )

            # Execute tools and add results
            for tc in tool_calls:
                if execute_tool_fn:
                    result = await execute_tool_fn(tc.name, tc.arguments)
                else:
                    result = "Tool execution not available"

                yield StreamChunk(
                    type=StreamChunkType.TOOL_RESULT,
                    content=result,
                    tool_name=tc.name,
                )

                current_messages.append(
                    ChatMessage(
                        role=ChatRole.TOOL,
                        content=result,
                        tool_call_id=tc.id,
                    )
                )
        else:
            yield StreamChunk(
                type=StreamChunkType.TEXT,
                content="\n\n(Reached maximum tool iterations. Please refine your question.)",
            )

    async def shutdown(self) -> None:
        """Clean up any resources held by the provider.

        Called during engine shutdown. Override if your provider
        holds connections or other resources.
        """
        pass
