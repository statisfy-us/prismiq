# Prismiq Examples

This directory contains example applications demonstrating Prismiq usage.

## Examples

### [basic-dashboard](./basic-dashboard/)

A minimal example showing how to:
- Connect to a PostgreSQL database
- Display schema information
- Execute queries and render results

**Stack:** React + Vite + Prismiq

### Running Examples

Each example has its own README with setup instructions. Generally:

```bash
cd examples/<example-name>

# Start the backend
cd backend && pip install -r requirements.txt && python main.py

# In another terminal, start the frontend
cd frontend && npm install && npm run dev
```

## Creating New Examples

1. Create a new directory under `examples/`
2. Include both backend and frontend code
3. Add a README with:
   - What the example demonstrates
   - Prerequisites
   - Setup instructions
   - Screenshots (if applicable)
