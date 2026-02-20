"""Google Gemini LLM provider implementation.

Uses the google-genai SDK to stream responses and handle tool calls.
Preserves raw Content objects to maintain thought_signature for Gemini 3 models.
"""

from __future__ import annotations

import logging
from collections.abc import AsyncIterator, Callable, Coroutine
from typing import Any

from prismiq.llm.provider import LLMProvider
from prismiq.llm.types import (
    ChatMessage,
    ChatRole,
    LLMConfig,
    StreamChunk,
    StreamChunkType,
    ToolDefinition,
)

_logger = logging.getLogger(__name__)


class GeminiProvider(LLMProvider):
    """LLM provider using Google Gemini via google-genai SDK."""

    def __init__(self, config: LLMConfig) -> None:
        super().__init__(config)
        self._client: Any = None

    def _get_client(self) -> Any:
        """Lazily create the Gemini client."""
        if self._client is None:
            try:
                from google import genai  # type: ignore[import-untyped]
            except ImportError as e:
                raise ImportError(
                    "google-genai is required for the Gemini provider. "
                    "Install it with: pip install prismiq[llm]"
                ) from e

            client_kwargs: dict[str, Any] = {}
            if self._config.api_key:
                client_kwargs["api_key"] = self._config.api_key
            if self._config.project_id:
                client_kwargs["project"] = self._config.project_id
                client_kwargs["vertexai"] = True
            if self._config.location:
                client_kwargs["location"] = self._config.location

            self._client = genai.Client(**client_kwargs)

        return self._client

    def _convert_user_messages(self, messages: list[ChatMessage]) -> tuple[str | None, list[Any]]:
        """Convert ChatMessages to Gemini Content objects for initial context."""
        from google.genai.types import Content, Part  # type: ignore[import-untyped]

        system_instruction: str | None = None
        contents: list[Any] = []

        for msg in messages:
            if msg.role == ChatRole.SYSTEM:
                system_instruction = msg.content
            elif msg.role == ChatRole.USER:
                contents.append(Content(role="user", parts=[Part(text=msg.content)]))
            elif msg.role == ChatRole.ASSISTANT:
                contents.append(Content(role="model", parts=[Part(text=msg.content)]))
            elif msg.role == ChatRole.TOOL:
                contents.append(Content(role="user", parts=[Part(text=msg.content)]))

        return system_instruction, contents

    def _convert_tools(self, tools: list[ToolDefinition]) -> list[Any]:
        """Convert tool definitions to Gemini Tool objects."""
        from google.genai.types import FunctionDeclaration, Tool  # type: ignore[import-untyped]

        declarations = []
        for tool in tools:
            decl_kwargs: dict[str, Any] = {
                "name": tool.name,
                "description": tool.description,
            }
            if tool.parameters:
                decl_kwargs["parameters"] = tool.parameters
            declarations.append(FunctionDeclaration(**decl_kwargs))

        return [Tool(function_declarations=declarations)]

    async def stream_chat(
        self,
        messages: list[ChatMessage],
        tools: list[ToolDefinition] | None = None,
    ) -> AsyncIterator[StreamChunk]:
        """Stream a single chat response from Gemini (no tool loop)."""
        client = self._get_client()
        system_instruction, contents = self._convert_user_messages(messages)

        config_kwargs: dict[str, Any] = {
            "temperature": self._config.temperature,
            "max_output_tokens": self._config.max_tokens,
        }
        if system_instruction:
            config_kwargs["system_instruction"] = system_instruction
        if tools:
            config_kwargs["tools"] = self._convert_tools(tools)

        try:
            response = await client.aio.models.generate_content_stream(
                model=self._config.model,
                contents=contents,
                config=config_kwargs,
            )

            async for chunk in response:
                if chunk.text:
                    yield StreamChunk(type=StreamChunkType.TEXT, content=chunk.text)

        except Exception as e:
            _logger.error("Gemini streaming error: %s", e)
            yield StreamChunk(type=StreamChunkType.ERROR, content=str(e))

    async def run_chat_loop(
        self,
        messages: list[ChatMessage],
        tools: list[ToolDefinition] | None = None,
        execute_tool_fn: Callable[[str, dict[str, Any]], Coroutine[Any, Any, str]] | None = None,
        max_iterations: int = 5,
    ) -> AsyncIterator[StreamChunk]:
        """Run the multi-turn tool loop using native Gemini Content objects.

        Preserves response.candidates[0].content (including thought_signature)
        so that Gemini 3 models work correctly with function calling.
        """
        from google.genai.types import Content, Part  # type: ignore[import-untyped]

        client = self._get_client()
        system_instruction, contents = self._convert_user_messages(messages)

        config_kwargs: dict[str, Any] = {
            "temperature": self._config.temperature,
            "max_output_tokens": self._config.max_tokens,
        }
        if system_instruction:
            config_kwargs["system_instruction"] = system_instruction
        if tools:
            config_kwargs["tools"] = self._convert_tools(tools)

        # Agent loop — uses non-streaming generate_content to preserve
        # raw Content objects (with thought_signature) for subsequent turns.
        for iteration in range(max_iterations):
            try:
                response = await client.aio.models.generate_content(
                    model=self._config.model,
                    contents=contents,
                    config=config_kwargs,
                )
            except Exception as e:
                _logger.error("Gemini generate error (iteration %d): %s", iteration, e)
                yield StreamChunk(type=StreamChunkType.ERROR, content=str(e))
                return

            # Extract text and function calls from response
            candidate = response.candidates[0] if response.candidates else None
            if not candidate or not candidate.content:
                break

            # Yield text content
            text = response.text or ""
            if text:
                yield StreamChunk(type=StreamChunkType.TEXT, content=text)

            # Check for function calls
            function_calls = response.function_calls or []

            if not function_calls:
                # No tool calls — we're done
                break

            # Preserve the raw model response Content (includes thought_signature)
            contents.append(candidate.content)

            # Execute each function call and build tool response parts
            tool_response_parts: list[Any] = []
            for fc in function_calls:
                yield StreamChunk(
                    type=StreamChunkType.TOOL_CALL,
                    tool_name=fc.name,
                    tool_args=dict(fc.args) if fc.args else {},
                )

                # Execute the tool
                if execute_tool_fn:
                    result = await execute_tool_fn(fc.name, dict(fc.args) if fc.args else {})
                else:
                    result = "Tool execution not available"

                _logger.info("Tool %s returned %d chars", fc.name, len(result))

                yield StreamChunk(
                    type=StreamChunkType.TOOL_RESULT,
                    content=result,
                    tool_name=fc.name,
                )

                tool_response_parts.append(
                    Part.from_function_response(
                        name=fc.name,
                        response={"result": result},
                    )
                )

            # Add tool results as a single "tool" content block
            contents.append(Content(role="user", parts=tool_response_parts))
        else:
            yield StreamChunk(
                type=StreamChunkType.TEXT,
                content="\n\n(Reached maximum tool iterations. Please refine your question.)",
            )

    async def shutdown(self) -> None:
        """Clean up the Gemini client."""
        self._client = None
