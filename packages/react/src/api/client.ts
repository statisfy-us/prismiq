/**
 * Prismiq API Client.
 *
 * Typed HTTP client for communicating with the Prismiq backend.
 */

import type {
  DatabaseSchema,
  QueryDefinition,
  QueryResult,
  TableSchema,
  ValidationResult,
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
  private readonly getToken?: () => Promise<string> | string;

  constructor(config: ClientConfig) {
    // Normalize endpoint - remove trailing slash
    this.endpoint = config.endpoint.replace(/\/$/, '');
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
      ...options.headers,
    };

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
        const errorBody = (await response.json()) as { detail?: string };
        if (errorBody.detail) {
          errorMessage = errorBody.detail;
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
}
