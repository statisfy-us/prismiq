# Prismiq Sprint Progress

## Current Sprint: Week 2 React SDK - Query Builder UI & Theming

## Status: COMPLETE

## Completed Tasks

### Week 1 - Python Backend (COMPLETE)
- [x] Task 1: Project setup (pyproject.toml, package structure)
- [x] Task 2: Type definitions (types.py)
- [x] Task 3: Schema introspection (schema.py)
- [x] Task 4: Query builder (query.py)
- [x] Task 5: Query executor (executor.py)
- [x] Task 6: FastAPI routes (api.py)
- [x] Task 7: Main engine class (engine.py)

### Week 1 - React SDK (COMPLETE)
- [x] Task 1: Package setup (package.json, tsconfig.json, tsup.config.ts)
- [x] Task 2: Type definitions (types.ts)
- [x] Task 3: API client (api/client.ts)
- [x] Task 4: Provider and context (context/AnalyticsProvider.tsx)
- [x] Task 5: Core hooks (useSchema.ts, useQuery.ts)
- [x] Task 6: Update index exports (index.ts)

### Week 2 - Python Backend (COMPLETE)
- [x] Task 1: Date/Time Utilities (dates.py)
- [x] Task 2: Number Formatting (formatting.py)
- [x] Task 3: Schema Customization (schema_config.py)
- [x] Task 4: Enhanced Query Validation (update query.py)
- [x] Task 5: Update API Routes (update api.py)
- [x] Task 6: Update Engine Integration (update engine.py, __init__.py)

### Week 2 - React SDK (COMPLETE)
- [x] Task 1: Theme System
- [x] Task 2: Base UI Components
- [x] Task 3: Schema Explorer
- [x] Task 4: Column Selector
- [x] Task 5: Filter Builder
- [x] Task 6: Sort Builder
- [x] Task 7: Aggregation Picker
- [x] Task 8: Results Table
- [x] Task 9: Query Builder Container
- [x] Task 10: Event Callbacks System
- [x] Task 11: Update Index Exports

## In Progress
None.

## Blocked
None.

## Key Decisions Made
| Decision | Rationale | Date |
|----------|-----------|------|
| asyncpg over psycopg2 | Native async, better performance | 2025-12-27 |
| Pydantic v2 | Faster, stricter validation | 2025-12-27 |
| SQLAlchemy Core (not ORM) | Runtime table discovery, dynamic SQL | 2025-12-27 |
| httpx for testing | Required for FastAPI TestClient | 2025-12-27 |
| reportUnusedFunction: false | FastAPI routes are accessed via decorators | 2025-12-27 |
| snake_case in TypeScript | Match Python backend types exactly | 2025-12-27 |
| Types before import/require in exports | Bundler compatibility (fixes esbuild warning) | 2025-12-27 |
| difflib for fuzzy matching | Built-in Python, provides "Did you mean?" suggestions | 2025-12-27 |
| ValidationError/ValidationResult models | Structured errors with codes, field paths, suggestions | 2025-12-27 |
| SchemaConfigManager pattern | Overlay config without mutating base schema | 2025-12-27 |
| CSS variables for theming | Runtime theme switching, easy customization | 2025-12-27 |
| Inline styles over CSS modules | Simpler bundling, CSS variable support | 2025-12-27 |
| HTML5 drag-and-drop | No external dependency for column reordering | 2025-12-27 |

## Validation Results

### Python (Week 2)
- Ruff linting: PASSED
- Pyright type checking: PASSED (0 errors)
- Pytest: PASSED (322 tests)

### React (Week 2)
- npm install: PASSED
- TypeScript typecheck: PASSED (0 errors)
- Build: PASSED (125KB ESM, 129KB CJS, 46KB .d.ts)

## Test Coverage

### Python (Week 1)
- test_types.py: 43 tests
- test_schema.py: 13 tests
- test_query.py: 40 tests
- test_executor.py: 15 tests
- test_api.py: 16 tests
- test_engine.py: 17 tests

### Python (Week 2)
- test_dates.py: 50+ tests (all 13 date presets, date_trunc, date_add)
- test_formatting.py: 50+ tests (number formatting, parsing)
- test_schema_config.py: 36 tests (config manager, enhanced schemas)
- test_validation.py: 26 tests (detailed errors, suggestions, field paths)

### React
- Tests not yet implemented (future task)

## React SDK Week 2 Components Created

### Theme System
- `/packages/react/src/theme/types.ts` - PrismiqTheme, ThemeMode, ThemeContextValue
- `/packages/react/src/theme/defaults.ts` - lightTheme, darkTheme
- `/packages/react/src/theme/ThemeProvider.tsx` - CSS variable injection, system preference detection
- `/packages/react/src/theme/useTheme.ts` - Theme hook

### UI Components
- `/packages/react/src/components/ui/Button.tsx` - primary/secondary/ghost/danger variants
- `/packages/react/src/components/ui/Input.tsx` - Text input with error state
- `/packages/react/src/components/ui/Select.tsx` - Generic searchable dropdown
- `/packages/react/src/components/ui/Checkbox.tsx` - Checkbox with label
- `/packages/react/src/components/ui/Badge.tsx` - Status badges
- `/packages/react/src/components/ui/Tooltip.tsx` - Hover tooltips
- `/packages/react/src/components/ui/Dropdown.tsx` - Menu dropdown
- `/packages/react/src/components/ui/Icon.tsx` - 28 SVG icons

### Query Builder Components
- `/packages/react/src/components/SchemaExplorer/` - Database schema tree view
- `/packages/react/src/components/ColumnSelector/` - Column selection with drag reorder
- `/packages/react/src/components/FilterBuilder/` - Type-aware filter conditions
- `/packages/react/src/components/SortBuilder/` - Sort order with priority
- `/packages/react/src/components/AggregationPicker/` - Aggregation dropdown
- `/packages/react/src/components/ResultsTable/` - Data grid with pagination
- `/packages/react/src/components/QueryBuilder/` - Main container component

## Notes
All Week 2 React SDK tasks complete. Query Builder UI is functional with theme support, all base UI components, schema exploration, filtering, sorting, and results display.
