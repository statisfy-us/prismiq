# Week 1: React SDK Foundation

## Overview
Build the core React SDK for Prismiq: types, API client, context provider, and essential hooks.

## Prerequisites
- Node.js 18+
- npm

## Setup Command
```bash
cd packages/react && npm install
```

## Validation Command
```bash
cd packages/react && npm run typecheck && npm run build
```

---

## Task 1: Package Setup

**Goal:** Initialize the React package with TypeScript and build configuration.

**Files to create:**
- `packages/react/package.json`
- `packages/react/tsconfig.json`
- `packages/react/tsup.config.ts`
- `packages/react/src/index.ts`

**package.json requirements:**
```json
{
  "name": "@prismiq/react",
  "version": "0.1.0",
  "type": "module",
  "main": "./dist/index.js",
  "module": "./dist/index.mjs",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/index.mjs",
      "require": "./dist/index.js",
      "types": "./dist/index.d.ts"
    }
  },
  "files": ["dist"],
  "scripts": {
    "build": "tsup",
    "typecheck": "tsc --noEmit",
    "dev": "tsup --watch"
  },
  "peerDependencies": {
    "react": "^18.0.0"
  },
  "devDependencies": {
    "@types/react": "^18.2.0",
    "react": "^18.2.0",
    "tsup": "^8.0.0",
    "typescript": "^5.3.0"
  }
}
```

**tsconfig.json requirements:**
- Strict mode enabled
- React JSX transform
- Target ES2020
- Module ESNext

**Validation:** `npm install` and `npm run typecheck` succeed.

---

## Task 2: Type Definitions

**Goal:** Create TypeScript types matching the Python backend exactly.

**File:** `packages/react/src/types.ts`

**Types to implement:**

1. **Schema Types:**
   ```typescript
   interface ColumnSchema {
     name: string;
     data_type: string;
     is_nullable: boolean;
     is_primary_key: boolean;
     default_value: string | null;
   }
   
   interface TableSchema {
     name: string;
     schema_name: string;
     columns: ColumnSchema[];
   }
   
   interface Relationship {
     from_table: string;
     from_column: string;
     to_table: string;
     to_column: string;
   }
   
   interface DatabaseSchema {
     tables: TableSchema[];
     relationships: Relationship[];
   }
   ```

2. **Query Types:**
   ```typescript
   interface QueryTable { id: string; name: string; alias?: string; }
   interface JoinDefinition { ... }
   type AggregationType = 'none' | 'sum' | 'avg' | 'count' | 'count_distinct' | 'min' | 'max';
   interface ColumnSelection { ... }
   type FilterOperator = 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'in_' | 'not_in' | 'like' | 'ilike' | 'between' | 'is_null' | 'is_not_null';
   interface FilterDefinition { ... }
   interface SortDefinition { ... }
   interface QueryDefinition { ... }
   ```

3. **Result Types:**
   ```typescript
   interface QueryResult {
     columns: string[];
     column_types: string[];
     rows: any[][];
     row_count: number;
     truncated: boolean;
     execution_time_ms: number;
   }
   ```

4. **Validation Types:**
   ```typescript
   interface ValidationResult {
     valid: boolean;
     errors: string[];
   }
   ```

**Requirements:**
- Export all types
- Use `type` for simple types, `interface` for objects
- Match Python types exactly (same field names, snake_case)

---

## Task 3: API Client

**Goal:** Create a typed HTTP client for the Prismiq backend.

**File:** `packages/react/src/api/client.ts`

**Class:** `PrismiqClient`

**Constructor:**
```typescript
interface ClientConfig {
  endpoint: string;
  getToken?: () => Promise<string> | string;
}

class PrismiqClient {
  constructor(config: ClientConfig)
}
```

**Methods:**
```typescript
async getSchema(): Promise<DatabaseSchema>
async getTables(): Promise<string[]>
async getTable(tableName: string): Promise<TableSchema>
async validateQuery(query: QueryDefinition): Promise<ValidationResult>
async executeQuery(query: QueryDefinition): Promise<QueryResult>
async previewQuery(query: QueryDefinition, limit?: number): Promise<QueryResult>
```

**Requirements:**
- Use fetch API
- Include Authorization header if getToken provided
- Handle errors consistently (throw typed errors)
- Type all responses

**Create error types:**
```typescript
class PrismiqError extends Error {
  constructor(message: string, public statusCode?: number) { ... }
}
```

---

## Task 4: Provider and Context

**Goal:** Create React context for providing the client and schema.

**File:** `packages/react/src/context/AnalyticsProvider.tsx`

**Provider:**
```typescript
interface AnalyticsProviderProps {
  config: ClientConfig;
  children: React.ReactNode;
}

function AnalyticsProvider({ config, children }: AnalyticsProviderProps): JSX.Element
```

**Context value:**
```typescript
interface AnalyticsContextValue {
  client: PrismiqClient;
  schema: DatabaseSchema | null;
  isLoading: boolean;
  error: Error | null;
  refetchSchema: () => Promise<void>;
}
```

**Behavior:**
- Create client on mount
- Fetch schema automatically on mount
- Provide refetchSchema for manual refresh
- Handle loading and error states

**Hook:**
```typescript
function useAnalytics(): AnalyticsContextValue
// Throws if used outside provider
```

**File:** `packages/react/src/context/index.ts`
- Export AnalyticsProvider, useAnalytics, AnalyticsContextValue

---

## Task 5: Core Hooks

**Goal:** Create hooks for querying data.

**Files:**
- `packages/react/src/hooks/useSchema.ts`
- `packages/react/src/hooks/useQuery.ts`
- `packages/react/src/hooks/index.ts`

### useSchema

```typescript
interface UseSchemaResult {
  schema: DatabaseSchema | null;
  tables: TableSchema[];
  relationships: Relationship[];
  isLoading: boolean;
  error: Error | null;
  getTable: (name: string) => TableSchema | undefined;
}

function useSchema(): UseSchemaResult
```

- Derives from context
- Provides helper methods

### useQuery

```typescript
interface UseQueryOptions {
  enabled?: boolean;      // Default true
  preview?: boolean;      // Default false
  previewLimit?: number;  // Default 100
}

interface UseQueryResult {
  data: QueryResult | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

function useQuery(
  query: QueryDefinition | null,
  options?: UseQueryOptions
): UseQueryResult
```

**Requirements:**
- Only execute when query is not null and enabled=true
- Use preview endpoint if preview=true
- Memoize query to prevent unnecessary re-fetches
- Handle cancellation on unmount

---

## Task 6: Update Index Exports

**File:** `packages/react/src/index.ts`

**Export everything:**
```typescript
// Types
export type {
  ColumnSchema,
  TableSchema,
  Relationship,
  DatabaseSchema,
  QueryTable,
  JoinDefinition,
  AggregationType,
  ColumnSelection,
  FilterOperator,
  FilterDefinition,
  SortDefinition,
  QueryDefinition,
  QueryResult,
  ValidationResult,
} from './types';

// Client
export { PrismiqClient, PrismiqError } from './api/client';
export type { ClientConfig } from './api/client';

// Context
export { AnalyticsProvider, useAnalytics } from './context';
export type { AnalyticsContextValue, AnalyticsProviderProps } from './context';

// Hooks
export { useSchema, useQuery } from './hooks';
export type { UseSchemaResult, UseQueryResult, UseQueryOptions } from './hooks';
```

---

## Completion Criteria

All tasks complete when:
- [ ] `npm install` succeeds
- [ ] `npm run typecheck` reports no errors
- [ ] `npm run build` produces dist/ with .js, .mjs, and .d.ts files
- [ ] All exports are properly typed
