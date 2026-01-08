/**
 * Prismiq API Client.
 *
 * Typed HTTP client for communicating with the Prismiq backend.
 */

import type {
  Dashboard,
  DashboardCreate,
  DashboardUpdate,
  DatabaseSchema,
  ExecuteSQLRequest,
  QueryDefinition,
  QueryResult,
  SavedQuery,
  SavedQueryCreate,
  SavedQueryUpdate,
  SQLValidationResult,
  TableSchema,
  ValidationResult,
  Widget,
  WidgetCreate,
  WidgetPositionUpdate,
  WidgetUpdate,
} from '../types';

// ============================================================================
// Configuration Types
// ============================================================================

/**
 * Configuration for the Prismiq client.
 */
export interface ClientConfig {
  /** Base URL of the Prismiq API endpoint. */
  endpoint: string;
  /**
   * Tenant ID for multi-tenant isolation.
   * All API calls will include this in the X-Tenant-ID header.
   * Required for production use.
   */
  tenantId: string;
  /**
   * User ID for ownership and permissions.
   * Included in X-User-ID header when provided.
   * Used for dashboard ownership and access control.
   */
  userId?: string;
  /** Optional function to get an authentication token. */
  getToken?: () => Promise<string> | string;
}

// ============================================================================
// Error Types
// ============================================================================

/**
 * Base error class for Prismiq API errors.
 */
export class PrismiqError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number
  ) {
    super(message);
    this.name = 'PrismiqError';
    // Restore prototype chain for instanceof to work
    Object.setPrototypeOf(this, PrismiqError.prototype);
  }
}

// ============================================================================
// API Client
// ============================================================================

/**
 * HTTP client for the Prismiq backend API.
 *
 * @example
 * ```typescript
 * const client = new PrismiqClient({
 *   endpoint: 'https://api.example.com/analytics',
 *   getToken: () => authService.getToken(),
 * });
 *
 * const schema = await client.getSchema();
 * const result = await client.executeQuery(query);
 * ```
 */
export class PrismiqClient {
  private readonly endpoint: string;
  private readonly tenantId: string;
  private readonly userId?: string;
  private readonly getToken?: () => Promise<string> | string;

  constructor(config: ClientConfig) {
    // Normalize endpoint - remove trailing slash
    this.endpoint = config.endpoint.replace(/\/$/, '');
    this.tenantId = config.tenantId;
    this.userId = config.userId;
    this.getToken = config.getToken;
  }

  /**
   * Make an authenticated request to the API.
   */
  private async request<T>(
    path: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.endpoint}${path}`;

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      'X-Tenant-ID': this.tenantId,
      ...options.headers,
    };

    // Add user ID header if provided
    if (this.userId) {
      (headers as Record<string, string>)['X-User-ID'] = this.userId;
    }

    // Add authorization header if token provider is configured
    if (this.getToken) {
      const token = await this.getToken();
      (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      let errorMessage = `API request failed: ${response.status} ${response.statusText}`;

      try {
        const errorBody = (await response.json()) as { detail?: string | Array<{ msg: string; loc?: string[] }> };
        if (errorBody.detail) {
          if (typeof errorBody.detail === 'string') {
            errorMessage = errorBody.detail;
          } else if (Array.isArray(errorBody.detail)) {
            // Pydantic validation errors are arrays of objects
            errorMessage = errorBody.detail
              .map((e) => e.msg + (e.loc ? ` (${e.loc.join('.')})` : ''))
              .join('; ');
          }
        }
      } catch {
        // Ignore JSON parse errors, use default message
      }

      throw new PrismiqError(errorMessage, response.status);
    }

    return response.json() as Promise<T>;
  }

  // ============================================================================
  // Generic Methods
  // ============================================================================

  /**
   * Make a GET request to the API.
   *
   * @param path - API path (starting with /)
   * @returns Response data
   */
  async get<T>(path: string): Promise<T> {
    return this.request<T>(path);
  }

  /**
   * Make a POST request to the API.
   *
   * @param path - API path (starting with /)
   * @param body - Request body (will be JSON stringified)
   * @returns Response data
   */
  async post<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>(path, {
      method: 'POST',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  }

  /**
   * Make a PUT request to the API.
   *
   * @param path - API path (starting with /)
   * @param body - Request body (will be JSON stringified)
   * @returns Response data
   */
  async put<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>(path, {
      method: 'PUT',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  }

  /**
   * Make a DELETE request to the API.
   *
   * @param path - API path (starting with /)
   * @returns Response data
   */
  async delete<T>(path: string): Promise<T> {
    return this.request<T>(path, { method: 'DELETE' });
  }

  // ============================================================================
  // Schema Methods
  // ============================================================================

  /**
   * Get the complete database schema.
   *
   * @returns The database schema including all tables and relationships.
   */
  async getSchema(): Promise<DatabaseSchema> {
    return this.request<DatabaseSchema>('/schema');
  }

  /**
   * Get a list of available table names.
   *
   * @returns Array of table names.
   */
  async getTables(): Promise<string[]> {
    return this.request<string[]>('/tables');
  }

  /**
   * Get schema information for a specific table.
   *
   * @param tableName - The name of the table.
   * @returns The table schema including columns.
   */
  async getTable(tableName: string): Promise<TableSchema> {
    return this.request<TableSchema>(`/tables/${encodeURIComponent(tableName)}`);
  }

  /**
   * Get sample values from a column for data preview.
   *
   * @param tableName - The name of the table.
   * @param columnName - The name of the column.
   * @param limit - Maximum number of distinct values to return (default: 5).
   * @returns Array of sample values.
   */
  async getColumnSample(
    tableName: string,
    columnName: string,
    limit: number = 5
  ): Promise<unknown[]> {
    const path = `/tables/${encodeURIComponent(tableName)}/columns/${encodeURIComponent(columnName)}/sample?limit=${limit}`;
    const result = await this.request<{ values: unknown[] }>(path);
    return result.values;
  }

  // ============================================================================
  // Query Methods
  // ============================================================================

  /**
   * Validate a query without executing it.
   *
   * @param query - The query definition to validate.
   * @returns Validation result with any errors.
   */
  async validateQuery(query: QueryDefinition): Promise<ValidationResult> {
    return this.request<ValidationResult>('/query/validate', {
      method: 'POST',
      body: JSON.stringify(query),
    });
  }

  /**
   * Generate SQL from a query definition without executing.
   *
   * @param query - The query definition.
   * @returns The generated SQL string.
   */
  async generateSql(query: QueryDefinition): Promise<string> {
    const result = await this.request<{ sql: string }>('/query/sql', {
      method: 'POST',
      body: JSON.stringify(query),
    });
    return result.sql;
  }

  /**
   * Execute a query and return the full result.
   *
   * @param query - The query definition to execute.
   * @returns The query result with all rows.
   */
  async executeQuery(query: QueryDefinition): Promise<QueryResult> {
    return this.request<QueryResult>('/query/execute', {
      method: 'POST',
      body: JSON.stringify(query),
    });
  }

  /**
   * Execute a query with a limited result set for previewing.
   *
   * @param query - The query definition to execute.
   * @param limit - Maximum number of rows to return (default: 100).
   * @returns The query result with limited rows.
   */
  async previewQuery(
    query: QueryDefinition,
    limit: number = 100
  ): Promise<QueryResult> {
    const url = `/query/preview?limit=${encodeURIComponent(limit)}`;
    return this.request<QueryResult>(url, {
      method: 'POST',
      body: JSON.stringify(query),
    });
  }

  // ============================================================================
  // Custom SQL Methods
  // ============================================================================

  /**
   * Validate a raw SQL query without executing it.
   *
   * Checks that the SQL is a valid SELECT statement and only
   * references tables visible in the schema.
   *
   * @param sql - Raw SQL query to validate.
   * @returns Validation result with any errors and referenced tables.
   */
  async validateSQL(sql: string): Promise<SQLValidationResult> {
    return this.request<SQLValidationResult>('/query/validate-sql', {
      method: 'POST',
      body: JSON.stringify({ sql }),
    });
  }

  /**
   * Execute a raw SQL query.
   *
   * Only SELECT statements are allowed. Queries are restricted
   * to tables visible in the schema.
   *
   * @param sql - Raw SQL query (SELECT only).
   * @param params - Optional named parameters for the query.
   * @returns The query result with all rows.
   */
  async executeSQL(
    sql: string,
    params?: Record<string, unknown>
  ): Promise<QueryResult> {
    const body: ExecuteSQLRequest = { sql };
    if (params) {
      body.params = params;
    }
    return this.request<QueryResult>('/query/execute-sql', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  // ============================================================================
  // Dashboard Methods
  // ============================================================================

  /**
   * List all dashboards accessible to the current user.
   *
   * @returns Array of dashboards.
   */
  async listDashboards(): Promise<Dashboard[]> {
    const response = await this.request<{ dashboards: Dashboard[] }>('/dashboards');
    return response.dashboards;
  }

  /**
   * Get a specific dashboard by ID.
   *
   * @param id - The dashboard ID.
   * @returns The dashboard with all widgets.
   */
  async getDashboard(id: string): Promise<Dashboard> {
    return this.request<Dashboard>(`/dashboards/${encodeURIComponent(id)}`);
  }

  /**
   * Create a new dashboard.
   *
   * @param data - Dashboard creation data.
   * @returns The created dashboard.
   */
  async createDashboard(data: DashboardCreate): Promise<Dashboard> {
    return this.request<Dashboard>('/dashboards', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  /**
   * Update an existing dashboard.
   *
   * @param id - The dashboard ID.
   * @param data - Dashboard update data.
   * @returns The updated dashboard.
   */
  async updateDashboard(id: string, data: DashboardUpdate): Promise<Dashboard> {
    return this.request<Dashboard>(`/dashboards/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  /**
   * Delete a dashboard.
   *
   * @param id - The dashboard ID.
   */
  async deleteDashboard(id: string): Promise<void> {
    await this.request<void>(`/dashboards/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
  }

  // ============================================================================
  // Widget Methods
  // ============================================================================

  /**
   * Add a widget to a dashboard.
   *
   * @param dashboardId - The dashboard ID.
   * @param data - Widget creation data.
   * @returns The created widget.
   */
  async addWidget(dashboardId: string, data: WidgetCreate): Promise<Widget> {
    return this.request<Widget>(
      `/dashboards/${encodeURIComponent(dashboardId)}/widgets`,
      {
        method: 'POST',
        body: JSON.stringify(data),
      }
    );
  }

  /**
   * Update a widget.
   *
   * @param dashboardId - The dashboard ID.
   * @param widgetId - The widget ID.
   * @param data - Widget update data.
   * @returns The updated widget.
   */
  async updateWidget(
    dashboardId: string,
    widgetId: string,
    data: WidgetUpdate
  ): Promise<Widget> {
    return this.request<Widget>(
      `/dashboards/${encodeURIComponent(dashboardId)}/widgets/${encodeURIComponent(widgetId)}`,
      {
        method: 'PUT',
        body: JSON.stringify(data),
      }
    );
  }

  /**
   * Delete a widget from a dashboard.
   *
   * @param dashboardId - The dashboard ID.
   * @param widgetId - The widget ID.
   */
  async deleteWidget(dashboardId: string, widgetId: string): Promise<void> {
    await this.request<void>(
      `/dashboards/${encodeURIComponent(dashboardId)}/widgets/${encodeURIComponent(widgetId)}`,
      {
        method: 'DELETE',
      }
    );
  }

  /**
   * Update the layout (positions) of multiple widgets.
   *
   * @param dashboardId - The dashboard ID.
   * @param positions - Array of widget position updates.
   * @returns The updated dashboard.
   */
  async updateLayout(
    dashboardId: string,
    positions: WidgetPositionUpdate[]
  ): Promise<Dashboard> {
    return this.request<Dashboard>(
      `/dashboards/${encodeURIComponent(dashboardId)}/layout`,
      {
        method: 'PUT',
        body: JSON.stringify(positions),
      }
    );
  }

  // ============================================================================
  // Saved Query Methods
  // ============================================================================

  /**
   * List all saved queries accessible to the current user.
   *
   * @returns Array of saved queries.
   */
  async listSavedQueries(): Promise<SavedQuery[]> {
    const response = await this.request<{ queries: SavedQuery[] }>(
      '/saved-queries'
    );
    return response.queries;
  }

  /**
   * Get a specific saved query by ID.
   *
   * @param id - The saved query ID.
   * @returns The saved query.
   */
  async getSavedQuery(id: string): Promise<SavedQuery> {
    return this.request<SavedQuery>(
      `/saved-queries/${encodeURIComponent(id)}`
    );
  }

  /**
   * Create a new saved query.
   *
   * @param data - Saved query creation data.
   * @returns The created saved query.
   */
  async createSavedQuery(data: SavedQueryCreate): Promise<SavedQuery> {
    return this.request<SavedQuery>('/saved-queries', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  /**
   * Update an existing saved query.
   *
   * @param id - The saved query ID.
   * @param data - Saved query update data.
   * @returns The updated saved query.
   */
  async updateSavedQuery(
    id: string,
    data: SavedQueryUpdate
  ): Promise<SavedQuery> {
    return this.request<SavedQuery>(
      `/saved-queries/${encodeURIComponent(id)}`,
      {
        method: 'PATCH',
        body: JSON.stringify(data),
      }
    );
  }

  /**
   * Delete a saved query.
   *
   * @param id - The saved query ID.
   */
  async deleteSavedQuery(id: string): Promise<void> {
    await this.request<void>(
      `/saved-queries/${encodeURIComponent(id)}`,
      {
        method: 'DELETE',
      }
    );
  }
}
