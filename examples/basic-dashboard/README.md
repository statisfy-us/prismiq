# Basic Dashboard Example

A minimal example demonstrating Prismiq's core functionality.

## What This Shows

- Schema discovery and display
- Basic query execution
- Result rendering in a table

## Prerequisites

- Python 3.10+
- Node.js 18+
- PostgreSQL database with some tables

## Setup

### 1. Start the Backend

```bash
cd backend

# Install dependencies
pip install prismiq

# Set your database connection
export DATABASE_URL="postgresql://user:pass@localhost:5432/yourdb"

# Run the server
python main.py
```

The API will be available at `http://localhost:8000`.

### 2. Start the Frontend

```bash
cd frontend

# Install dependencies
npm install

# Start dev server
npm run dev
```

Open `http://localhost:5173` in your browser.

## Screenshot

```
┌─────────────────────────────────────────────┐
│ Prismiq Basic Dashboard                     │
├─────────────────────────────────────────────┤
│ Available Tables                            │
│ • public.users                              │
│   - id (integer)                            │
│   - email (text)                            │
│   - created_at (timestamp)                  │
│ • public.orders                             │
│   - id (integer)                            │
│   - user_id (integer)                       │
│   - total (numeric)                         │
├─────────────────────────────────────────────┤
│ Query Demo                                  │
│ [users________] [Run Query]                 │
│                                             │
│ | id | email          | created_at        | │
│ |----|----------------|-------------------| │
│ | 1  | alice@test.com | 2024-01-15 10:00  | │
│ | 2  | bob@test.com   | 2024-01-16 14:30  | │
│                                             │
│ Showing 2 of 2 rows                         │
└─────────────────────────────────────────────┘
```
