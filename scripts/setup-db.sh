#!/usr/bin/env bash
# Database setup script for Prismiq
# Usage: ./scripts/setup-db.sh

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "🗄️  Prismiq Database Setup"
echo ""

# Check for DATABASE_URL
if [ -z "$DATABASE_URL" ]; then
    if [ -f .env ]; then
        export $(grep -v '^#' .env | grep DATABASE_URL | xargs)
    fi
fi

if [ -z "$DATABASE_URL" ]; then
    echo -e "${YELLOW}DATABASE_URL not set. Choose a setup option:${NC}"
    echo ""
    echo "1) Postgres.app (macOS) - Lightest, recommended for Mac"
    echo "   → Download from https://postgresapp.com"
    echo "   → Click 'Initialize' then 'Start'"
    echo "   → Run: createdb prismiq_dev"
    echo ""
    echo "2) Native PostgreSQL"
    echo "   → macOS:  brew install postgresql@16 && brew services start postgresql@16"
    echo "   → Ubuntu: sudo apt install postgresql && sudo systemctl start postgresql"
    echo "   → Then:   createdb prismiq_dev"
    echo ""
    echo "3) Neon (cloud - no install)"
    echo "   → Sign up at https://neon.tech (free tier)"
    echo "   → Create project, copy connection string"
    echo ""
    echo "4) Supabase (cloud - no install)"
    echo "   → Sign up at https://supabase.com (free tier)"
    echo "   → Create project, get connection string from Settings > Database"
    echo ""
    echo "5) Docker (if you have it)"
    echo "   → Run: docker compose up -d"
    echo ""
    echo -e "${YELLOW}After setup, create .env file:${NC}"
    echo "  cp .env.example .env"
    echo "  # Edit DATABASE_URL in .env"
    echo ""
    echo "Then re-run this script."
    exit 1
fi

echo -e "Using: ${GREEN}${DATABASE_URL%@*}@***${NC}"
echo ""

# Test connection
echo "Testing connection..."
if command -v psql &> /dev/null; then
    if psql "$DATABASE_URL" -c "SELECT 1" &> /dev/null; then
        echo -e "${GREEN}✓ Connection successful${NC}"
    else
        echo -e "${RED}✗ Connection failed${NC}"
        echo "  Check your DATABASE_URL and ensure PostgreSQL is running"
        exit 1
    fi
else
    echo -e "${YELLOW}⚠ psql not found, skipping connection test${NC}"
fi

# Run seed script
echo ""
echo "Seeding database..."
if command -v psql &> /dev/null; then
    psql "$DATABASE_URL" -f scripts/seed.sql
    echo -e "${GREEN}✓ Database seeded${NC}"
else
    echo -e "${YELLOW}⚠ psql not found. Run manually:${NC}"
    echo "  psql \$DATABASE_URL -f scripts/seed.sql"
fi

echo ""
echo -e "${GREEN}✅ Database ready!${NC}"
echo ""
echo "Tables created:"
echo "  • customers (5 rows)"
echo "  • products (5 rows)"
echo "  • orders (6 rows)"
echo "  • order_items (8 rows)"
