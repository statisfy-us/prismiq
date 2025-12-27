"""
Basic Prismiq Backend Example

This demonstrates the minimal setup for a Prismiq backend server.
"""
from prismiq import PrismiqEngine
import os

# Database connection from environment variable
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://postgres:postgres@localhost:5432/example"
)

# Initialize the engine
engine = PrismiqEngine(
    database_url=DATABASE_URL,
    allowed_schemas=["public"],  # Restrict to public schema
    max_rows=10000,              # Limit query results
    query_timeout=30,            # 30 second timeout
)

if __name__ == "__main__":
    # Run the API server
    engine.run(
        host="0.0.0.0",
        port=8000,
        reload=True,  # Enable hot reload in development
    )
