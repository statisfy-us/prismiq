# API Reference

Complete reference for the Prismiq backend API endpoints.

## Base URL

All endpoints are relative to your configured API base URL, typically:
- Development: `http://localhost:8000/api`
- Production: `https://your-api.com/api/analytics`

## Authentication

All endpoints require tenant identification via headers:

| Header | Required | Description |
|--------|----------|-------------|
| `X-Tenant-ID` | Yes | Tenant identifier for data isolation |
| `X-User-ID` | No | User identifier for ownership |
| `X-Schema-Name` | No | PostgreSQL schema for per-tenant isolation |
| `Authorization` | Depends | `Bearer <token>` for authenticated endpoints |

---

## Health Endpoints

### GET /health

Comprehensive health status including database connectivity.

**Response:**
```json
{
  "status": "healthy",
  "database": "connected",
  "cache": "connected",
  "version": "1.0.0",
  "uptime_seconds": 3600
}
```

### GET /health/live

Kubernetes liveness probe. Returns 200 if the service is running.

**Response:**
```json
{ "status": "ok" }
```

### GET /health/ready

Kubernetes readiness probe. Returns 200 if the service can handle requests.

**Response:**
```json
{
  "status": "ready",
  "database": "connected"
}
```

---

## Schema Endpoints

### GET /schema

Get the complete database schema including all tables and relationships.

**Response:**
```json
{
  "tables": [
    {
      "name": "orders",
      "schema_name": "public",
      "columns": [
        {
          "name": "id",
          "data_type": "integer",
          "is_nullable": false,
          "is_primary_key": true,
          "default_value": "nextval('orders_id_seq'::regclass)"
        },
        {
          "name": "customer_id",
          "data_type": "integer",
          "is_nullable": true,
          "is_primary_key": false,
          "default_value": null
        },
        {
          "name": "amount",
          "data_type": "numeric",
          "is_nullable": false,
          "is_primary_key": false,
          "default_value": null
        }
      ],
      "row_count": 15000
    }
  ],
  "relationships": [
    {
      "from_table": "orders",
      "from_column": "customer_id",
      "to_table": "customers",
      "to_column": "id"
    }
  ]
}
```

### GET /tables

List all available table names.

**Response:**
```json
["orders", "customers", "products", "payments"]
```

### GET /tables/{table_name}

Get schema for a specific table.

**Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `table_name` | string | Name of the table |

**Response:**
```json
{
  "name": "orders",
  "schema_name": "public",
  "columns": [...],
  "row_count": 15000
}
```

### GET /tables/{table_name}/columns/{column_name}/sample

Get sample values from a column for data preview.

**Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `table_name` | string | - | Name of the table |
| `column_name` | string | - | Name of the column |
| `limit` | integer | 5 | Max distinct values to return |

**Response:**
```json
{
  "values": ["completed", "pending", "cancelled", "processing", "shipped"]
}
```

---

## Query Endpoints

### POST /query/validate

Validate a query definition without executing it.

**Request Body:**
```json
{
  "tables": [{ "id": "t1", "name": "orders" }],
  "columns": [
    { "table_id": "t1", "column": "status", "aggregation": "none" },
    { "table_id": "t1", "column": "amount", "aggregation": "sum" }
  ],
  "group_by": [{ "table_id": "t1", "column": "status" }]
}
```

**Response (valid):**
```json
{
  "valid": true,
  "errors": []
}
```

**Response (invalid):**
```json
{
  "valid": false,
  "errors": [
    "Table 'orders' does not exist",
    "Column 'status' not found in table 'orders'"
  ]
}
```

### POST /query/sql

Generate SQL from a query definition without executing.

**Request Body:** Same as `/query/validate`

**Response:**
```json
{
  "sql": "SELECT \"status\", SUM(\"amount\") AS \"amount\" FROM \"public\".\"orders\" GROUP BY \"status\""
}
```

### POST /query/execute

Execute a query and return results.

**Request Body:**
```json
{
  "query": {
    "tables": [{ "id": "t1", "name": "orders" }],
    "columns": [
      { "table_id": "t1", "column": "status", "aggregation": "none" },
      { "table_id": "t1", "column": "amount", "aggregation": "sum" }
    ],
    "group_by": [{ "table_id": "t1", "column": "status" }]
  },
  "bypass_cache": false
}
```

**Response:**
```json
{
  "columns": ["status", "amount"],
  "column_types": ["character varying", "numeric"],
  "rows": [
    ["completed", 45000.00],
    ["pending", 12000.00],
    ["cancelled", 3000.00]
  ],
  "row_count": 3,
  "truncated": false,
  "execution_time_ms": 45,
  "cached_at": 1706572800,
  "is_from_cache": true
}
```

### POST /query/preview

Execute a query with a row limit for previewing.

**Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `limit` | integer | 100 | Maximum rows to return |

**Request Body:** Same as `/query/execute`

**Response:** Same as `/query/execute`

### POST /query/validate-sql

Validate a raw SQL query. Checks syntax, table/column existence, and SELECT-only restriction.

**Request Body:**
```json
{
  "sql": "SELECT * FROM orders WHERE status = 'completed'"
}
```

**Response (valid):**
```json
{
  "valid": true,
  "errors": [],
  "tables": ["orders"]
}
```

**Response (invalid):**
```json
{
  "valid": false,
  "errors": ["Only SELECT statements are allowed"],
  "tables": []
}
```

### POST /query/execute-sql

Execute a raw SQL query (SELECT only). The query is validated before execution.

**Request Body:**
```json
{
  "sql": "SELECT region, SUM(amount) as total FROM orders GROUP BY region",
  "params": {}
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `sql` | `string` | Yes | Raw SQL query (SELECT only) |
| `params` | `object` | No | Named parameters for the query |

**Response:** Same as `/query/execute`

**Security:** Only SELECT statements are allowed. INSERT, UPDATE, DELETE, DROP, and DDL statements are rejected with a 400 error.

### POST /query/execute/timeseries

Execute a query with time series bucketing.

**Request Body:**
```json
{
  "query": {
    "tables": [{ "id": "t1", "name": "orders" }],
    "columns": [
      { "table_id": "t1", "column": "created_at", "aggregation": "none" },
      { "table_id": "t1", "column": "amount", "aggregation": "sum" }
    ],
    "time_series": {
      "table_id": "t1",
      "date_column": "created_at",
      "interval": "month",
      "fill_missing": true,
      "fill_value": 0
    }
  }
}
```

---

## Dashboard Endpoints

### GET /dashboards

List all dashboards accessible to the current user.

**Response:**
```json
{
  "dashboards": [
    {
      "id": "d1",
      "name": "Sales Overview",
      "description": "Monthly sales metrics",
      "owner_id": "user_123",
      "is_public": false,
      "allowed_viewers": [],
      "widgets": [...],
      "filters": [],
      "layout": { "columns": 12, "row_height": 100 },
      "created_at": "2024-01-15T10:30:00Z",
      "updated_at": "2024-01-20T14:45:00Z"
    }
  ]
}
```

### GET /dashboards/{id}

Get a specific dashboard by ID.

**Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string | Dashboard ID |

**Response:**
```json
{
  "id": "d1",
  "name": "Sales Overview",
  "description": "Monthly sales metrics",
  "owner_id": "user_123",
  "is_public": false,
  "allowed_viewers": [],
  "widgets": [
    {
      "id": "w1",
      "type": "bar_chart",
      "title": "Revenue by Region",
      "query": {...},
      "position": { "x": 0, "y": 0, "w": 6, "h": 4 },
      "config": {
        "xAxis": "region",
        "yAxis": ["revenue"],
        "orientation": "vertical"
      },
      "created_at": "2024-01-15T10:30:00Z",
      "updated_at": "2024-01-15T10:30:00Z"
    }
  ],
  "filters": [],
  "layout": { "columns": 12, "row_height": 100 },
  "created_at": "2024-01-15T10:30:00Z",
  "updated_at": "2024-01-20T14:45:00Z"
}
```

### POST /dashboards

Create a new dashboard.

**Request Body:**
```json
{
  "name": "New Dashboard",
  "description": "Dashboard description",
  "layout": {
    "columns": 12,
    "row_height": 100
  }
}
```

**Response:** Created dashboard object

### PATCH /dashboards/{id}

Update an existing dashboard.

**Request Body:**
```json
{
  "name": "Updated Name",
  "description": "Updated description",
  "is_public": true,
  "allowed_viewers": ["user_456", "user_789"],
  "filters": [...],
  "layout": { "columns": 12, "row_height": 120 }
}
```

**Response:** Updated dashboard object

### DELETE /dashboards/{id}

Delete a dashboard.

**Response:** `204 No Content`

### PUT /dashboards/{id}/layout

Update widget positions (batch update).

**Request Body:**
```json
[
  { "widget_id": "w1", "position": { "x": 0, "y": 0, "w": 6, "h": 4 } },
  { "widget_id": "w2", "position": { "x": 6, "y": 0, "w": 6, "h": 4 } }
]
```

**Response:** Updated dashboard object

### GET /dashboards/{id}/export

Export a dashboard for backup/sharing.

**Response:**
```json
{
  "version": "1.0",
  "dashboard": {...},
  "exported_at": "2024-01-20T14:45:00Z"
}
```

### POST /dashboards/import

Import a dashboard from export.

**Request Body:** Export response object

**Response:** Created dashboard object

---

## Widget Endpoints

### POST /dashboards/{id}/widgets

Add a widget to a dashboard.

**Request Body:**
```json
{
  "type": "bar_chart",
  "title": "Sales by Region",
  "query": {
    "tables": [{ "id": "t1", "name": "orders" }],
    "columns": [
      { "table_id": "t1", "column": "region", "aggregation": "none" },
      { "table_id": "t1", "column": "amount", "aggregation": "sum" }
    ],
    "group_by": [{ "table_id": "t1", "column": "region" }]
  },
  "position": { "x": 0, "y": 0, "w": 6, "h": 4 },
  "config": {
    "xAxis": "region",
    "yAxis": ["amount"],
    "orientation": "vertical"
  }
}
```

**Response:** Created widget object

### PUT /dashboards/{id}/widgets/{widget_id}

Update a widget.

**Request Body:**
```json
{
  "title": "Updated Title",
  "query": {...},
  "position": { "x": 0, "y": 0, "w": 8, "h": 4 },
  "config": {...}
}
```

**Response:** Updated widget object

### DELETE /dashboards/{id}/widgets/{widget_id}

Delete a widget from a dashboard.

**Response:** `204 No Content`

---

## Saved Query Endpoints

### GET /saved-queries

List all saved queries.

**Response:**
```json
{
  "queries": [
    {
      "id": "sq1",
      "name": "Monthly Revenue",
      "description": "Revenue aggregated by month",
      "query": {...},
      "tenant_id": "tenant_123",
      "owner_id": "user_123",
      "is_shared": true,
      "created_at": "2024-01-15T10:30:00Z",
      "updated_at": "2024-01-15T10:30:00Z"
    }
  ]
}
```

### GET /saved-queries/{id}

Get a specific saved query.

**Response:** Saved query object

### POST /saved-queries

Create a new saved query.

**Request Body:**
```json
{
  "name": "Top Customers",
  "description": "Customers by total spend",
  "query": {
    "tables": [{ "id": "t1", "name": "orders" }],
    "columns": [
      { "table_id": "t1", "column": "customer_id", "aggregation": "none" },
      { "table_id": "t1", "column": "amount", "aggregation": "sum" }
    ],
    "group_by": [{ "table_id": "t1", "column": "customer_id" }],
    "order_by": [{ "table_id": "t1", "column": "amount", "direction": "DESC" }],
    "limit": 10
  },
  "is_shared": false
}
```

**Response:** Created saved query object

### PATCH /saved-queries/{id}

Update a saved query.

**Request Body:**
```json
{
  "name": "Updated Name",
  "is_shared": true
}
```

**Response:** Updated saved query object

### DELETE /saved-queries/{id}

Delete a saved query.

**Response:** `204 No Content`

---

## Pin Endpoints

### GET /pins

Get pinned dashboards for a context.

**Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `context` | string | Context name (e.g., "favorites", "accounts") |

**Response:**
```json
{
  "dashboards": [
    { "id": "d1", "name": "Sales Overview", ... },
    { "id": "d2", "name": "Customer Metrics", ... }
  ],
  "pins": [
    {
      "id": "p1",
      "dashboard_id": "d1",
      "context": "favorites",
      "position": 0,
      "pinned_at": "2024-01-15T10:30:00Z"
    },
    {
      "id": "p2",
      "dashboard_id": "d2",
      "context": "favorites",
      "position": 1,
      "pinned_at": "2024-01-16T14:00:00Z"
    }
  ]
}
```

### POST /pins

Pin a dashboard to a context.

**Request Body:**
```json
{
  "dashboard_id": "d1",
  "context": "favorites",
  "position": 0
}
```

**Response:** Created pin object

### DELETE /pins

Unpin a dashboard from a context.

**Request Body:**
```json
{
  "dashboard_id": "d1",
  "context": "favorites"
}
```

**Response:** `204 No Content`

### GET /dashboards/{id}/pins

Get all contexts where a dashboard is pinned.

**Response:**
```json
{
  "contexts": ["favorites", "accounts"]
}
```

### PUT /pins/order

Reorder pinned dashboards within a context.

**Request Body:**
```json
{
  "context": "favorites",
  "dashboard_ids": ["d2", "d1", "d3"]
}
```

**Response:** `200 OK`

---

## Transform Endpoints

### POST /transform/pivot

Pivot data from long to wide format.

**Request Body:**
```json
{
  "data": {
    "columns": ["region", "month", "revenue"],
    "rows": [
      ["US", "Jan", 1000],
      ["US", "Feb", 1200],
      ["EU", "Jan", 800],
      ["EU", "Feb", 900]
    ]
  },
  "row_field": "region",
  "column_field": "month",
  "value_field": "revenue"
}
```

**Response:**
```json
{
  "columns": ["region", "Jan", "Feb"],
  "rows": [
    ["US", 1000, 1200],
    ["EU", 800, 900]
  ]
}
```

### POST /transform/trend

Add trend calculations to data.

**Request Body:**
```json
{
  "data": {...},
  "date_column": "month",
  "value_column": "revenue",
  "trend_type": "percentage"
}
```

### POST /metrics/trend

Calculate metric trends (YoY, period comparison).

**Request Body:**
```json
{
  "query": {...},
  "current_period": { "start": "2024-01-01", "end": "2024-01-31" },
  "comparison_period": { "start": "2023-01-01", "end": "2023-01-31" },
  "metrics": ["revenue", "orders"]
}
```

---

## LLM Endpoints

These endpoints are only available when the LLM is enabled via `LLMConfig`. See [SQL Mode & AI Assistant](./sql-mode.md) for setup instructions.

### GET /llm/status

Check if the LLM assistant is enabled and which provider/model is configured.

**Response (enabled):**
```json
{
  "enabled": true,
  "provider": "gemini",
  "model": "gemini-2.0-flash"
}
```

**Response (disabled):**
```json
{
  "enabled": false
}
```

### POST /llm/chat

Stream a chat response from the AI SQL assistant using Server-Sent Events (SSE).

The assistant can make tool calls to inspect the database schema before generating SQL.

**Request Body:**
```json
{
  "message": "Show me total revenue by month for 2024",
  "history": [
    { "role": "user", "content": "What tables do I have?" },
    { "role": "assistant", "content": "You have users, orders, and products tables." }
  ],
  "current_sql": "SELECT * FROM orders"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `message` | `string` | Yes | User's natural language message |
| `history` | `ChatMessage[]` | No | Previous conversation messages for context |
| `current_sql` | `string \| null` | No | Current SQL in the editor (provides context) |

**Response:** Server-Sent Events stream with JSON chunks:

```
data: {"type": "text", "content": "Let me look at your schema..."}

data: {"type": "tool_call", "tool_name": "get_schema_overview", "tool_args": {}}

data: {"type": "tool_result", "content": "{\"tables\": [...]}"}

data: {"type": "text", "content": "Here's the query:\n```sql\nSELECT ...```"}

data: {"type": "sql", "content": "SELECT DATE_TRUNC('month', \"created_at\") AS month, SUM(\"amount\") AS revenue FROM \"public\".\"orders\" WHERE \"created_at\" >= '2024-01-01' GROUP BY month ORDER BY month"}

data: {"type": "done"}
```

**Stream chunk types:**

| Type | Description |
|------|-------------|
| `text` | Assistant response text (may contain markdown) |
| `sql` | Extracted SQL query from ```sql code blocks |
| `tool_call` | Tool invocation (`tool_name` and `tool_args` fields) |
| `tool_result` | JSON result from tool execution |
| `error` | Error message (includes correlation ID) |
| `done` | Stream complete |

**Error handling:** On internal errors, the stream emits an error chunk with a correlation ID rather than leaking exception details:
```
data: {"type": "error", "content": "Internal server error (ref: a1b2c3d4)"}
```

---

## Error Responses

All endpoints return consistent error responses:

**400 Bad Request:**
```json
{
  "detail": "Invalid query: Column 'foo' not found in table 'orders'"
}
```

**401 Unauthorized:**
```json
{
  "detail": "Missing or invalid authentication"
}
```

**403 Forbidden:**
```json
{
  "detail": "Not authorized to access this dashboard"
}
```

**404 Not Found:**
```json
{
  "detail": "Dashboard not found"
}
```

**422 Validation Error:**
```json
{
  "detail": [
    {
      "loc": ["body", "query", "tables", 0, "name"],
      "msg": "field required",
      "type": "value_error.missing"
    }
  ]
}
```

**500 Internal Server Error:**
```json
{
  "detail": "An unexpected error occurred"
}
```
