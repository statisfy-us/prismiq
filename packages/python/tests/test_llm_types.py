"""Tests for LLM type definitions."""

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

# ============================================================================
# LLMConfig Tests
# ============================================================================


class TestLLMConfig:
    """Tests for LLMConfig model."""

    def test_defaults(self) -> None:
        """Test default config values."""
        config = LLMConfig()
        assert config.enabled is False
        assert config.provider == LLMProviderType.GEMINI
        assert config.model == "gemini-2.0-flash"
        assert config.api_key is None
        assert config.project_id is None
        assert config.location is None
        assert config.max_tokens == 4096
        assert config.temperature == 0.1
        assert config.max_tool_iterations == 10

    def test_enabled_config(self) -> None:
        """Test creating an enabled config."""
        config = LLMConfig(
            enabled=True,
            provider=LLMProviderType.GEMINI,
            model="gemini-2.0-flash",
            project_id="my-project",
            location="us-central1",
        )
        assert config.enabled is True
        assert config.project_id == "my-project"
        assert config.location == "us-central1"

    def test_openai_provider(self) -> None:
        """Test OpenAI provider config."""
        config = LLMConfig(
            enabled=True,
            provider=LLMProviderType.OPENAI,
            model="gpt-4",
            api_key="sk-test-key",
        )
        assert config.provider == LLMProviderType.OPENAI
        assert config.api_key == "sk-test-key"

    def test_custom_temperature(self) -> None:
        """Test custom temperature and max_tokens."""
        config = LLMConfig(temperature=0.7, max_tokens=8192)
        assert config.temperature == 0.7
        assert config.max_tokens == 8192


# ============================================================================
# ChatMessage Tests
# ============================================================================


class TestChatMessage:
    """Tests for ChatMessage model."""

    def test_user_message(self) -> None:
        """Test creating a user message."""
        msg = ChatMessage(role=ChatRole.USER, content="Hello")
        assert msg.role == ChatRole.USER
        assert msg.content == "Hello"
        assert msg.tool_call_id is None
        assert msg.tool_calls is None

    def test_assistant_message_with_tool_calls(self) -> None:
        """Test assistant message with tool calls."""
        tool_calls = [
            ToolCallRequest(
                id="call_1",
                name="get_schema_overview",
                arguments={},
            ),
        ]
        msg = ChatMessage(
            role=ChatRole.ASSISTANT,
            content="Let me check the schema.",
            tool_calls=tool_calls,
        )
        assert msg.role == ChatRole.ASSISTANT
        assert msg.tool_calls is not None
        assert len(msg.tool_calls) == 1
        assert msg.tool_calls[0].name == "get_schema_overview"

    def test_tool_message(self) -> None:
        """Test tool result message."""
        msg = ChatMessage(
            role=ChatRole.TOOL,
            content='{"tables": ["users"]}',
            tool_call_id="call_1",
        )
        assert msg.role == ChatRole.TOOL
        assert msg.tool_call_id == "call_1"

    def test_system_message(self) -> None:
        """Test system message."""
        msg = ChatMessage(role=ChatRole.SYSTEM, content="You are a SQL assistant.")
        assert msg.role == ChatRole.SYSTEM


# ============================================================================
# StreamChunk Tests
# ============================================================================


class TestStreamChunk:
    """Tests for StreamChunk model."""

    def test_text_chunk(self) -> None:
        """Test text chunk."""
        chunk = StreamChunk(type=StreamChunkType.TEXT, content="Here is a query")
        assert chunk.type == StreamChunkType.TEXT
        assert chunk.content == "Here is a query"

    def test_sql_chunk(self) -> None:
        """Test SQL chunk."""
        chunk = StreamChunk(type=StreamChunkType.SQL, content="SELECT * FROM users")
        assert chunk.type == StreamChunkType.SQL
        assert chunk.content == "SELECT * FROM users"

    def test_tool_call_chunk(self) -> None:
        """Test tool call chunk."""
        chunk = StreamChunk(
            type=StreamChunkType.TOOL_CALL,
            tool_name="get_table_details",
            tool_args={"table_name": "users"},
        )
        assert chunk.type == StreamChunkType.TOOL_CALL
        assert chunk.tool_name == "get_table_details"
        assert chunk.tool_args == {"table_name": "users"}

    def test_error_chunk(self) -> None:
        """Test error chunk."""
        chunk = StreamChunk(type=StreamChunkType.ERROR, content="Something went wrong")
        assert chunk.type == StreamChunkType.ERROR

    def test_done_chunk(self) -> None:
        """Test done chunk."""
        chunk = StreamChunk(type=StreamChunkType.DONE)
        assert chunk.type == StreamChunkType.DONE
        assert chunk.content == ""

    def test_tool_result_chunk(self) -> None:
        """Test tool result chunk."""
        chunk = StreamChunk(
            type=StreamChunkType.TOOL_RESULT,
            content='{"valid": true}',
            tool_name="validate_sql",
        )
        assert chunk.type == StreamChunkType.TOOL_RESULT
        assert chunk.tool_name == "validate_sql"


# ============================================================================
# ToolDefinition Tests
# ============================================================================


class TestToolDefinition:
    """Tests for ToolDefinition model."""

    def test_basic_tool(self) -> None:
        """Test creating a basic tool."""
        tool = ToolDefinition(
            name="test_tool",
            description="A test tool.",
            parameters={"type": "object", "properties": {}},
        )
        assert tool.name == "test_tool"
        assert tool.description == "A test tool."

    def test_tool_with_required_params(self) -> None:
        """Test tool with required parameters."""
        tool = ToolDefinition(
            name="get_table_details",
            description="Get details.",
            parameters={
                "type": "object",
                "properties": {
                    "table_name": {"type": "string"},
                },
                "required": ["table_name"],
            },
        )
        assert "required" in tool.parameters
        assert "table_name" in tool.parameters["required"]


# ============================================================================
# ChatRequest Tests
# ============================================================================


class TestChatRequest:
    """Tests for ChatRequest model."""

    def test_basic_request(self) -> None:
        """Test creating a basic chat request."""
        req = ChatRequest(message="Show me all users")
        assert req.message == "Show me all users"
        assert req.history == []
        assert req.current_sql is None

    def test_request_with_context(self) -> None:
        """Test request with SQL context and history."""
        history = [
            ChatMessage(role=ChatRole.USER, content="Hello"),
            ChatMessage(role=ChatRole.ASSISTANT, content="Hi! How can I help?"),
        ]
        req = ChatRequest(
            message="Add a WHERE clause",
            history=history,
            current_sql="SELECT * FROM users",
        )
        assert req.current_sql == "SELECT * FROM users"
        assert len(req.history) == 2

    def test_request_with_widget_context(self) -> None:
        """Test request with widget context."""
        ctx = WidgetContext(widget_type="pie_chart")
        req = ChatRequest(
            message="Show revenue by region",
            widget_context=ctx,
        )
        assert req.widget_context is not None
        assert req.widget_context.widget_type == "pie_chart"

    def test_request_without_widget_context(self) -> None:
        """Test request without widget context (backward compat)."""
        req = ChatRequest(message="Hello")
        assert req.widget_context is None


# ============================================================================
# WidgetContext Tests
# ============================================================================


class TestWidgetContext:
    """Tests for WidgetContext model."""

    def test_minimal(self) -> None:
        """Test creating a minimal widget context."""
        ctx = WidgetContext(widget_type="metric")
        assert ctx.widget_type == "metric"
        assert ctx.x_axis is None
        assert ctx.y_axis is None
        assert ctx.series_column is None
        assert ctx.last_error is None

    def test_full(self) -> None:
        """Test creating a fully populated widget context."""
        ctx = WidgetContext(
            widget_type="bar_chart",
            x_axis="region",
            y_axis=["revenue", "profit"],
            series_column="category",
            last_error="No numeric columns found",
        )
        assert ctx.widget_type == "bar_chart"
        assert ctx.x_axis == "region"
        assert ctx.y_axis == ["revenue", "profit"]
        assert ctx.series_column == "category"
        assert ctx.last_error == "No numeric columns found"


# ============================================================================
# STATUS StreamChunkType Tests
# ============================================================================


class TestStatusChunkType:
    """Tests for STATUS stream chunk type."""

    def test_status_chunk(self) -> None:
        """Test creating a status chunk."""
        chunk = StreamChunk(type=StreamChunkType.STATUS, content="Inspecting database schema...")
        assert chunk.type == StreamChunkType.STATUS
        assert chunk.content == "Inspecting database schema..."

    def test_status_enum_value(self) -> None:
        """Test STATUS enum has correct string value."""
        assert StreamChunkType.STATUS.value == "status"
