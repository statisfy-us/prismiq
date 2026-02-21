"""Type definitions for the LLM subsystem.

Pydantic models for configuration, messages, streaming chunks,
and tool calling.
"""

from __future__ import annotations

from enum import Enum
from typing import Any

from pydantic import BaseModel, ConfigDict, Field

from prismiq.dashboards import WidgetType

# ============================================================================
# Configuration
# ============================================================================


class LLMProviderType(str, Enum):
    """Supported LLM provider types."""

    GEMINI = "gemini"
    OPENAI = "openai"
    ANTHROPIC = "anthropic"


class LLMConfig(BaseModel):
    """Configuration for the LLM agent."""

    model_config = ConfigDict()

    enabled: bool = False
    """Whether the LLM agent is enabled."""

    provider: LLMProviderType = LLMProviderType.GEMINI
    """LLM provider to use."""

    model: str = "gemini-2.0-flash"
    """Model name/ID to use."""

    api_key: str | None = None
    """API key for the provider (if applicable)."""

    project_id: str | None = None
    """GCP project ID (for Gemini via Vertex AI)."""

    location: str | None = None
    """GCP region (for Gemini via Vertex AI)."""

    max_tokens: int = 4096
    """Maximum tokens in the response."""

    temperature: float = 0.1
    """Temperature for response generation."""

    max_tool_iterations: int = Field(default=10, ge=1)
    """Maximum number of tool-call rounds per agent turn."""


# ============================================================================
# Chat Messages
# ============================================================================


class ChatRole(str, Enum):
    """Roles in a chat conversation."""

    USER = "user"
    ASSISTANT = "assistant"
    SYSTEM = "system"
    TOOL = "tool"


class ChatMessage(BaseModel):
    """A single message in a chat conversation."""

    model_config = ConfigDict()

    role: ChatRole
    """Role of the message sender."""

    content: str
    """Text content of the message."""

    tool_call_id: str | None = None
    """ID of the tool call this message is responding to (for tool role)."""

    tool_calls: list[ToolCallRequest] | None = None
    """Tool calls requested by the assistant."""


# ============================================================================
# Tool Calling
# ============================================================================


class ToolDefinition(BaseModel):
    """Definition of a tool available to the LLM."""

    model_config = ConfigDict()

    name: str
    """Tool name (function name)."""

    description: str
    """Description of what the tool does."""

    parameters: dict[str, Any] = Field(default_factory=dict)
    """JSON Schema for the tool's parameters."""


class ToolCallRequest(BaseModel):
    """A request from the LLM to call a tool."""

    model_config = ConfigDict()

    id: str
    """Unique ID for this tool call."""

    name: str
    """Name of the tool to call."""

    arguments: dict[str, Any] = Field(default_factory=dict)
    """Arguments to pass to the tool."""


# ============================================================================
# Streaming
# ============================================================================


class StreamChunkType(str, Enum):
    """Types of chunks in a streaming response."""

    TEXT = "text"
    SQL = "sql"
    TOOL_CALL = "tool_call"
    TOOL_RESULT = "tool_result"
    STATUS = "status"
    ERROR = "error"
    DONE = "done"


class StreamChunk(BaseModel):
    """A single chunk in a streaming response."""

    model_config = ConfigDict()

    type: StreamChunkType
    """Type of this chunk."""

    content: str = ""
    """Text content (for text/sql/error chunks)."""

    tool_name: str | None = None
    """Tool name (for tool_call/tool_result chunks)."""

    tool_args: dict[str, Any] | None = None
    """Tool arguments (for tool_call chunks)."""


# ============================================================================
# Widget Context
# ============================================================================


class WidgetContext(BaseModel):
    """Context about the target widget for SQL generation.

    Tells the LLM what kind of widget the query is for, so it can
    generate queries with the correct column structure.
    """

    widget_type: WidgetType
    """Widget type."""

    x_axis: str | None = None
    """Configured x-axis column."""

    y_axis: list[str] | None = None
    """Configured y-axis column(s)."""

    series_column: str | None = None
    """Multi-series grouping column."""

    last_error: str | None = None
    """Last execution error for self-correction."""


# ============================================================================
# API Request
# ============================================================================


class ChatRequest(BaseModel):
    """Request to the /llm/chat endpoint."""

    model_config = ConfigDict()

    message: str
    """User's message."""

    history: list[ChatMessage] = Field(default_factory=list)
    """Previous conversation messages."""

    current_sql: str | None = None
    """Current SQL in the editor (for context)."""

    widget_context: WidgetContext | None = None
    """Optional context about the target widget type."""
