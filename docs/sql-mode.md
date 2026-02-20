# SQL Mode & AI SQL Assistant

Prismiq includes a **Custom SQL Mode** for power users who want to write raw SQL, and an optional **AI SQL Assistant** that helps generate queries from natural language.

## Overview

The widget editor offers four data source modes:

| Mode | Description |
|------|-------------|
| **Guided** | Visual query builder with dropdowns |
| **Advanced** | Query builder with calculated fields and time series |
| **Saved** | Pick from saved query library |
| **SQL** | Write raw SQL with schema browser and optional AI assistant |

SQL mode is ideal when you need full control over the query — complex CTEs, window functions, or anything the visual builder doesn't support.

---

## SQL Mode

### Widget Editor Layout

When SQL mode is selected, the widget editor shows three panels:

```text
┌──────────────┬────────────────────────┬─────────────────┐
│ Schema       │                        │                 │
│ Explorer     │   SQL Editor           │  AI Chat        │
│ (collapsible)│                        │  (if LLM        │
│              │                        │   enabled)      │
│ Tables:      │  SELECT "name",        │                 │
│  ▸ users     │    COUNT(*) as total   │  "Show me       │
│  ▸ orders    │  FROM "public"."users" │   monthly       │
│  ▸ products  │  GROUP BY "name"       │   revenue"      │
│              │                        │                 │
│              │  [Run Query]           │  [Apply to      │
│              │                        │   Editor]       │
└──────────────┴────────────────────────┴─────────────────┘
     220px           flex: 1                  340px
```

### Schema Explorer

The collapsible sidebar lists all available tables and their columns. Click a column to insert `"table"."column"` into the SQL editor.

### SQL Editor

The editor provides:
- SQL textarea with monospace font
- **Run Query** button (also Cmd/Ctrl+Enter)
- Real-time validation (checks table/column existence, SELECT-only enforcement)
- Detected tables display

### How Widgets Store SQL

SQL-mode widgets use two fields in `WidgetConfig`:

```typescript
interface WidgetConfig {
  // ... other fields ...
  raw_sql?: string;                              // The SQL query
  data_source_mode?: 'guided' | 'advanced' | 'saved' | 'sql';
}
```

When `data_source_mode === 'sql'` and `raw_sql` is present, the dashboard executes the raw SQL instead of using the query definition.

### SQL Validation Rules

All raw SQL queries are validated before execution:

1. **SELECT only** — INSERT, UPDATE, DELETE, DROP, and DDL statements are rejected
2. **Table existence** — Referenced tables must exist in the exposed schema
3. **Column existence** — Referenced columns are validated against the schema
4. **Identifier quoting** — Always use double quotes: `SELECT "column" FROM "schema"."table"`

### Backend Configuration

SQL execution uses the same `PrismiqEngine` — no extra configuration needed:

```python
engine = PrismiqEngine(
    database_url="postgresql://...",
    query_timeout=30.0,   # Also applies to SQL queries
    max_rows=10000,       # Also applies to SQL queries
)
```

---

## AI SQL Assistant

The AI SQL Assistant is an optional LLM-powered chat panel that helps users write SQL queries through natural language conversation.

### Architecture

```text
┌────────────────┐      SSE stream       ┌──────────────────────┐
│ React Frontend │◄─────────────────────►│  Prismiq Backend     │
│                │                        │                      │
│ ChatPanel      │  POST /llm/chat        │  Agent Loop          │
│ useLLMChat     │────────────────────►  │  ├── System Prompt    │
│ useLLMStatus   │                        │  ├── Tool Calls       │
│                │  GET /llm/status        │  │   ├── get_schema   │
│                │────────────────────►  │  │   ├── get_table    │
│                │                        │  │   ├── get_rels     │
│                │                        │  │   └── validate_sql │
│                │                        │  └── LLM Provider     │
│                │                        │       └── Gemini      │
└────────────────┘                        └──────────────────────┘
```

The assistant:
1. Receives the user's natural language request
2. Inspects the database schema using tool calls
3. Generates a SQL query with explanation
4. Returns the SQL in a code block with an "Apply to Editor" button

### Enabling the LLM

The LLM is disabled by default. Enable it by passing `llm_config` to the engine:

```python
from prismiq import PrismiqEngine
from prismiq.llm import LLMConfig, LLMProviderType

engine = PrismiqEngine(
    database_url="postgresql://...",
    llm_config=LLMConfig(
        enabled=True,
        provider=LLMProviderType.GEMINI,
        model="gemini-2.0-flash",
        api_key="your-gemini-api-key",
    ),
)
```

#### Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `enabled` | `bool` | `False` | Enable LLM features |
| `provider` | `LLMProviderType` | `GEMINI` | LLM provider |
| `model` | `str` | `"gemini-2.0-flash"` | Model identifier |
| `api_key` | `str \| None` | `None` | API key for the provider |
| `project_id` | `str \| None` | `None` | GCP project ID (Vertex AI) |
| `location` | `str \| None` | `None` | GCP region (Vertex AI) |
| `max_tokens` | `int` | `4096` | Max response tokens |
| `temperature` | `float` | `0.1` | Low temperature for deterministic SQL |

#### Environment Variables (Demo App)

```bash
LLM_ENABLED=1
LLM_PROVIDER=gemini
LLM_MODEL=gemini-2.0-flash
LLM_API_KEY=your-api-key

# For Vertex AI (alternative to API key)
GOOGLE_PROJECT_ID=my-project
GOOGLE_LOCATION=us-central1
```

#### Install Optional Dependencies

The LLM feature requires the `google-genai` package:

```bash
pip install prismiq[llm]
# or
uv add "prismiq[llm]"
```

### Frontend Integration

The chat panel appears automatically when the LLM is enabled. No frontend configuration is needed — the React SDK detects LLM availability via the `/llm/status` endpoint.

#### How It Works

1. **Status check**: On mount, `useLLMStatus` calls `GET /llm/status`. If `enabled: true`, the ChatPanel renders.
2. **User sends message**: The message and current SQL context are sent to `POST /llm/chat` as an SSE stream.
3. **Agent loop**: The backend runs a multi-turn agent loop — the LLM can call schema tools before generating SQL.
4. **Streaming response**: Text chunks stream into the chat. SQL blocks are detected and extracted.
5. **Apply to Editor**: Users click "Apply to Editor" on any SQL block to populate the SQL editor.

#### React Hooks

**useLLMStatus** — Check if LLM is available:

```tsx
import { useLLMStatus } from '@prismiq/react';

function MyComponent() {
  const { enabled, provider, model, isLoading, error } = useLLMStatus();

  if (!enabled) return null; // LLM not configured
  return <div>AI powered by {model}</div>;
}
```

**useLLMChat** — Full chat state management:

```tsx
import { useLLMChat } from '@prismiq/react';

function ChatUI() {
  const {
    messages,           // Full message history
    isStreaming,        // Currently generating
    streamingContent,   // Partial response text
    suggestedSql,       // Last extracted SQL block
    sendMessage,        // Send a message
    clearHistory,       // Reset conversation
    error,              // Error message
  } = useLLMChat();

  const handleSend = () => {
    sendMessage("Show me total revenue by month", currentSql);
  };
}
```

### LLM Tools

The agent has access to four schema inspection tools:

| Tool | Description |
|------|-------------|
| `get_schema_overview` | List all tables with columns and row counts |
| `get_table_details` | Detailed schema of a specific table |
| `get_relationships` | Foreign key relationships between tables |
| `validate_sql` | Validate SQL syntax and table/column existence |

These tools allow the LLM to explore your database schema before generating queries, ensuring accurate column names and proper joins.

### System Prompt

The LLM receives a system prompt that includes:
- Available tables and columns from the current schema
- Foreign key relationships
- Rules (SELECT only, quote identifiers, use tools, add LIMIT)

This means the assistant is aware of your actual database schema and can generate queries that reference real tables and columns.

### Multi-Tenant Support

The LLM respects multi-tenancy. When a `schema_name` is provided (via `X-Schema-Name` header), all tool calls and SQL generation use that schema:

```sql
-- With schema_name="org_12345"
SELECT "name", COUNT(*) FROM "org_12345"."users" GROUP BY "name"
```

---

## API Endpoints

### GET /llm/status

Check if the LLM is enabled and available.

**Response:**
```json
{
  "enabled": true,
  "provider": "gemini",
  "model": "gemini-2.0-flash"
}
```

If the LLM is not configured, returns `{ "enabled": false }`.

### POST /llm/chat

Stream a chat response using Server-Sent Events (SSE).

**Request Body:**
```json
{
  "message": "Show me total revenue by month",
  "history": [
    { "role": "user", "content": "What tables are available?" },
    { "role": "assistant", "content": "You have users, orders, and products..." }
  ],
  "current_sql": "SELECT * FROM orders"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `message` | `string` | Yes | User's message |
| `history` | `ChatMessage[]` | No | Previous conversation messages |
| `current_sql` | `string` | No | Current SQL in the editor (provides context) |

**Response (SSE stream):**

```text
data: {"type": "text", "content": "Let me look at your schema..."}

data: {"type": "tool_call", "tool_name": "get_schema_overview", "tool_args": {}}

data: {"type": "tool_result", "content": "{\"tables\": [...]}"}

data: {"type": "text", "content": "Here's the query:\n```sql\nSELECT ...```"}

data: {"type": "sql", "content": "SELECT DATE_TRUNC('month', created_at) ..."}

data: {"type": "done"}
```

**Stream chunk types:**

| Type | Description |
|------|-------------|
| `text` | Assistant response text |
| `sql` | Extracted SQL block (from ```sql code blocks) |
| `tool_call` | Tool invocation (tool_name + tool_args) |
| `tool_result` | Tool execution result |
| `error` | Error message |
| `done` | Stream complete |

---

## Security

### SQL Injection Prevention

- Raw SQL is validated before execution (SELECT-only check)
- Table and column names are validated against the schema
- The LLM system prompt enforces identifier quoting

### Error Message Redaction

- Backend exceptions are not leaked to clients
- Errors return a correlation ID for server-side debugging: `"Internal server error (ref: a1b2c3d4)"`

### Tool Argument Redaction

- Tool arguments containing SQL are not logged to prevent PII exposure
- Only tool names are logged: `"Executing tool: get_table_details"`

### Model Safety

- Low temperature (0.1) for deterministic, safer SQL generation
- System prompt enforces SELECT-only restriction
- `validate_sql` tool prevents DDL/DML execution

---

## Graceful Degradation

The SQL assistant is fully optional:

| Scenario | Behavior |
|----------|----------|
| LLM not configured | ChatPanel is hidden; SQL editor works standalone |
| `/llm/status` fails | `useLLMStatus` returns `enabled: false`; no error shown |
| `/llm/chat` errors | Error displayed in chat panel; SQL editor unaffected |
| LLM package not installed | Engine starts without LLM; all other features work |

SQL mode works independently of the LLM — users can always write SQL manually.
