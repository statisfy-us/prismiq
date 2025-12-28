"""
Sample Data Generator for Prismiq Demo.

Creates tables and inserts sample data for demonstrating
Prismiq's analytics capabilities.

Run with:
    DATABASE_URL=postgresql://... python seed_data.py
"""

from __future__ import annotations

import asyncio
import json
import os
import random
import sys
from datetime import datetime, timedelta
from decimal import Decimal

import asyncpg

# Sample data constants
REGIONS = ["North", "South", "East", "West"]
TIERS = ["Gold", "Silver", "Bronze"]
CATEGORIES = ["Electronics", "Clothing", "Home", "Sports"]
ORDER_STATUSES = ["completed", "pending", "cancelled"]
EVENT_TYPES = ["page_view", "signup", "purchase", "login"]

# Sample product names by category
PRODUCT_NAMES = {
    "Electronics": [
        "Wireless Headphones",
        "Smart Watch",
        "Bluetooth Speaker",
        "USB-C Hub",
        "Webcam HD",
        "Mechanical Keyboard",
        "Gaming Mouse",
        "Monitor Stand",
        "Portable Charger",
        "Phone Case",
        "Screen Protector",
        "HDMI Cable",
    ],
    "Clothing": [
        "Cotton T-Shirt",
        "Denim Jeans",
        "Running Shoes",
        "Winter Jacket",
        "Baseball Cap",
        "Sports Socks",
        "Leather Belt",
        "Wool Sweater",
        "Dress Shirt",
        "Cargo Shorts",
        "Rain Jacket",
        "Sneakers",
    ],
    "Home": [
        "LED Desk Lamp",
        "Coffee Maker",
        "Throw Pillow",
        "Kitchen Scale",
        "Cutting Board",
        "Shower Curtain",
        "Wall Clock",
        "Picture Frame",
        "Candle Set",
        "Storage Box",
        "Bath Towels",
        "Plant Pot",
    ],
    "Sports": [
        "Yoga Mat",
        "Dumbbells",
        "Resistance Bands",
        "Water Bottle",
        "Fitness Tracker",
        "Jump Rope",
        "Tennis Balls",
        "Swim Goggles",
        "Basketball",
        "Running Belt",
        "Gym Bag",
        "Foam Roller",
    ],
}

# Sample first and last names for customers
FIRST_NAMES = [
    "James",
    "Mary",
    "John",
    "Patricia",
    "Robert",
    "Jennifer",
    "Michael",
    "Linda",
    "William",
    "Elizabeth",
    "David",
    "Barbara",
    "Richard",
    "Susan",
    "Joseph",
    "Jessica",
    "Thomas",
    "Sarah",
    "Charles",
    "Karen",
    "Christopher",
    "Nancy",
    "Daniel",
    "Lisa",
    "Matthew",
    "Betty",
    "Anthony",
    "Margaret",
    "Mark",
    "Sandra",
    "Donald",
    "Ashley",
    "Steven",
    "Kimberly",
    "Paul",
    "Emily",
    "Andrew",
    "Donna",
    "Joshua",
    "Michelle",
]

LAST_NAMES = [
    "Smith",
    "Johnson",
    "Williams",
    "Brown",
    "Jones",
    "Garcia",
    "Miller",
    "Davis",
    "Rodriguez",
    "Martinez",
    "Hernandez",
    "Lopez",
    "Gonzalez",
    "Wilson",
    "Anderson",
    "Thomas",
    "Taylor",
    "Moore",
    "Jackson",
    "Martin",
    "Lee",
    "Perez",
    "Thompson",
    "White",
    "Harris",
    "Sanchez",
    "Clark",
    "Ramirez",
    "Lewis",
    "Robinson",
    "Walker",
]


# SQL for creating tables
CREATE_TABLES_SQL = """
-- Drop existing tables (in order due to foreign keys)
DROP TABLE IF EXISTS events CASCADE;
DROP TABLE IF EXISTS order_items CASCADE;
DROP TABLE IF EXISTS orders CASCADE;
DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS customers CASCADE;

-- Customers table
CREATE TABLE customers (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE,
    region VARCHAR(50),
    tier VARCHAR(20),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Products table
CREATE TABLE products (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    category VARCHAR(50),
    price DECIMAL(10,2) NOT NULL,
    cost DECIMAL(10,2),
    stock_quantity INTEGER DEFAULT 0
);

-- Orders table
CREATE TABLE orders (
    id SERIAL PRIMARY KEY,
    customer_id INTEGER REFERENCES customers(id),
    order_date DATE NOT NULL,
    status VARCHAR(20),
    total_amount DECIMAL(10,2),
    shipping_address TEXT
);

-- Order items table
CREATE TABLE order_items (
    id SERIAL PRIMARY KEY,
    order_id INTEGER REFERENCES orders(id),
    product_id INTEGER REFERENCES products(id),
    quantity INTEGER NOT NULL,
    unit_price DECIMAL(10,2) NOT NULL
);

-- Events table (for time series data)
CREATE TABLE events (
    id SERIAL PRIMARY KEY,
    event_type VARCHAR(50),
    user_id INTEGER,
    timestamp TIMESTAMP NOT NULL,
    properties JSONB
);

-- Create indexes for better query performance
CREATE INDEX idx_orders_customer ON orders(customer_id);
CREATE INDEX idx_orders_date ON orders(order_date);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_order_items_order ON order_items(order_id);
CREATE INDEX idx_order_items_product ON order_items(product_id);
CREATE INDEX idx_events_type ON events(event_type);
CREATE INDEX idx_events_timestamp ON events(timestamp);
CREATE INDEX idx_events_user ON events(user_id);
"""


def generate_email(first_name: str, last_name: str, index: int) -> str:
    """Generate a unique email address."""
    domains = ["example.com", "demo.com", "test.org", "sample.net"]
    domain = random.choice(domains)
    return f"{first_name.lower()}.{last_name.lower()}{index}@{domain}"


def generate_address() -> str:
    """Generate a random shipping address."""
    street_nums = random.randint(100, 9999)
    streets = ["Main St", "Oak Ave", "Maple Dr", "Cedar Ln", "Park Rd", "Lake Blvd"]
    cities = [
        "New York",
        "Los Angeles",
        "Chicago",
        "Houston",
        "Phoenix",
        "Philadelphia",
    ]
    states = ["NY", "CA", "IL", "TX", "AZ", "PA"]
    zips = random.randint(10000, 99999)

    idx = random.randint(0, len(cities) - 1)
    return (
        f"{street_nums} {random.choice(streets)}, {cities[idx]}, {states[idx]} {zips}"
    )


async def seed_customers(conn: asyncpg.Connection, count: int = 100) -> list[int]:
    """Seed customers table and return customer IDs."""
    print(f"  Inserting {count} customers...")

    customer_ids = []
    for i in range(count):
        first_name = random.choice(FIRST_NAMES)
        last_name = random.choice(LAST_NAMES)
        name = f"{first_name} {last_name}"
        email = generate_email(first_name, last_name, i)
        region = random.choice(REGIONS)
        tier = random.choices(TIERS, weights=[20, 40, 40])[0]  # Gold is rarer

        # Random creation date in the past year
        days_ago = random.randint(0, 365)
        created_at = datetime.now() - timedelta(days=days_ago)

        customer_id = await conn.fetchval(
            """
            INSERT INTO customers (name, email, region, tier, created_at)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING id
            """,
            name,
            email,
            region,
            tier,
            created_at,
        )
        customer_ids.append(customer_id)

    return customer_ids


async def seed_products(conn: asyncpg.Connection, count: int = 50) -> list[int]:
    """Seed products table and return product IDs."""
    print(f"  Inserting {count} products...")

    product_ids = []
    products_per_category = count // len(CATEGORIES)

    for category in CATEGORIES:
        names = PRODUCT_NAMES[category]
        for i in range(products_per_category):
            name = names[i % len(names)]
            if i >= len(names):
                name = f"{name} v{i // len(names) + 1}"

            # Generate realistic prices based on category
            if category == "Electronics":
                price = Decimal(str(round(random.uniform(15, 200), 2)))
            elif category == "Clothing":
                price = Decimal(str(round(random.uniform(10, 100), 2)))
            elif category == "Home":
                price = Decimal(str(round(random.uniform(5, 80), 2)))
            else:  # Sports
                price = Decimal(str(round(random.uniform(8, 120), 2)))

            cost = price * Decimal(str(random.uniform(0.4, 0.7)))
            cost = Decimal(str(round(float(cost), 2)))
            stock = random.randint(0, 500)

            product_id = await conn.fetchval(
                """
                INSERT INTO products (name, category, price, cost, stock_quantity)
                VALUES ($1, $2, $3, $4, $5)
                RETURNING id
                """,
                name,
                category,
                price,
                cost,
                stock,
            )
            product_ids.append(product_id)

    return product_ids


async def seed_orders(
    conn: asyncpg.Connection,
    customer_ids: list[int],
    product_ids: list[int],
    order_count: int = 500,
) -> None:
    """Seed orders and order_items tables."""
    print(f"  Inserting {order_count} orders with items...")

    # Get product prices
    products = await conn.fetch("SELECT id, price FROM products")
    product_prices = {p["id"]: p["price"] for p in products}

    total_items = 0
    for _ in range(order_count):
        customer_id = random.choice(customer_ids)

        # Random date in the last 90 days
        days_ago = random.randint(0, 90)
        order_date = (datetime.now() - timedelta(days=days_ago)).date()

        # Status with weighted distribution: 70% completed, 20% pending, 10% cancelled
        status = random.choices(ORDER_STATUSES, weights=[70, 20, 10])[0]

        address = generate_address()

        # Insert order first with NULL total
        order_id = await conn.fetchval(
            """
            INSERT INTO orders (customer_id, order_date, status, total_amount, shipping_address)
            VALUES ($1, $2, $3, NULL, $4)
            RETURNING id
            """,
            customer_id,
            order_date,
            status,
            address,
        )

        # Add 1-5 items to the order
        num_items = random.randint(1, 5)
        order_total = Decimal("0.00")

        # Ensure unique products per order
        order_products = random.sample(product_ids, min(num_items, len(product_ids)))

        for product_id in order_products:
            quantity = random.randint(1, 4)
            unit_price = product_prices[product_id]

            await conn.execute(
                """
                INSERT INTO order_items (order_id, product_id, quantity, unit_price)
                VALUES ($1, $2, $3, $4)
                """,
                order_id,
                product_id,
                quantity,
                unit_price,
            )

            order_total += unit_price * quantity
            total_items += 1

        # Update order with total
        await conn.execute(
            "UPDATE orders SET total_amount = $1 WHERE id = $2", order_total, order_id
        )

    print(f"    Created {total_items} order items")


async def seed_events(
    conn: asyncpg.Connection,
    customer_ids: list[int],
    count: int = 5000,
) -> None:
    """Seed events table for time series data."""
    print(f"  Inserting {count} events...")

    # Batch insert for performance
    batch_size = 500
    events = []

    for i in range(count):
        event_type = random.choices(
            EVENT_TYPES,
            weights=[60, 10, 15, 15],  # page_view most common
        )[0]

        # Some events are from registered users, some are anonymous
        user_id = random.choice(customer_ids) if random.random() > 0.3 else None

        # Random timestamp in the last 90 days
        seconds_ago = random.randint(0, 90 * 24 * 60 * 60)
        timestamp = datetime.now() - timedelta(seconds=seconds_ago)

        # Generate properties based on event type
        if event_type == "page_view":
            properties = {
                "page": random.choice(
                    ["/", "/products", "/cart", "/checkout", "/account"]
                ),
                "referrer": random.choice(["google", "facebook", "direct", "email"]),
            }
        elif event_type == "purchase":
            properties = {
                "amount": round(random.uniform(10, 500), 2),
                "items": random.randint(1, 5),
            }
        elif event_type == "signup":
            properties = {
                "source": random.choice(["organic", "paid", "referral"]),
            }
        else:  # login
            properties = {
                "method": random.choice(["password", "google", "facebook"]),
            }

        events.append((event_type, user_id, timestamp, json.dumps(properties)))

        # Insert batch
        if len(events) >= batch_size:
            await conn.executemany(
                """
                INSERT INTO events (event_type, user_id, timestamp, properties)
                VALUES ($1, $2, $3, $4)
                """,
                events,
            )
            events = []

    # Insert remaining
    if events:
        await conn.executemany(
            """
            INSERT INTO events (event_type, user_id, timestamp, properties)
            VALUES ($1, $2, $3, $4)
            """,
            events,
        )


async def main() -> None:
    """Main function to seed the database."""
    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        print("ERROR: DATABASE_URL environment variable not set")
        print(
            "Example: DATABASE_URL=postgresql://prismiq:prismiq_demo@localhost:5432/prismiq_demo"
        )
        sys.exit(1)

    print("Connecting to database...")
    conn = await asyncpg.connect(database_url)

    try:
        print("Creating tables...")
        await conn.execute(CREATE_TABLES_SQL)

        print("Seeding data...")
        customer_ids = await seed_customers(conn, count=100)
        product_ids = await seed_products(conn, count=50)
        await seed_orders(conn, customer_ids, product_ids, order_count=500)
        await seed_events(conn, customer_ids, count=5000)

        print("\nData seeding complete!")
        print("  - 100 customers")
        print("  - 50 products")
        print("  - 500 orders with ~1500 items")
        print("  - 5000 events")

    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(main())
