-- Prismiq Development Seed Data
-- This creates sample tables for testing schema introspection and queries

-- Clean slate
DROP TABLE IF EXISTS order_items CASCADE;
DROP TABLE IF EXISTS orders CASCADE;
DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS customers CASCADE;

-- Customers table
CREATE TABLE customers (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    company VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Products table
CREATE TABLE products (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    sku VARCHAR(50) UNIQUE NOT NULL,
    price DECIMAL(10, 2) NOT NULL,
    category VARCHAR(100),
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Orders table
CREATE TABLE orders (
    id SERIAL PRIMARY KEY,
    customer_id INTEGER NOT NULL REFERENCES customers(id),
    status VARCHAR(50) DEFAULT 'pending',
    total_amount DECIMAL(12, 2),
    order_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    shipped_at TIMESTAMP WITH TIME ZONE,
    CONSTRAINT valid_status CHECK (status IN ('pending', 'processing', 'shipped', 'delivered', 'cancelled'))
);

-- Order items (line items)
CREATE TABLE order_items (
    id SERIAL PRIMARY KEY,
    order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id INTEGER NOT NULL REFERENCES products(id),
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    unit_price DECIMAL(10, 2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX idx_orders_customer ON orders(customer_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_date ON orders(order_date);
CREATE INDEX idx_order_items_order ON order_items(order_id);
CREATE INDEX idx_order_items_product ON order_items(product_id);
CREATE INDEX idx_products_category ON products(category);

-- Sample data: Customers
INSERT INTO customers (name, email, company) VALUES
    ('Alice Johnson', 'alice@example.com', 'Acme Corp'),
    ('Bob Smith', 'bob@example.com', 'TechStart Inc'),
    ('Carol Williams', 'carol@example.com', 'DataFlow LLC'),
    ('David Brown', 'david@example.com', NULL),
    ('Eve Davis', 'eve@example.com', 'CloudNine Systems');

-- Sample data: Products
INSERT INTO products (name, sku, price, category) VALUES
    ('Analytics Dashboard', 'DASH-001', 299.00, 'Software'),
    ('Data Connector', 'CONN-001', 99.00, 'Software'),
    ('Premium Support', 'SUP-001', 499.00, 'Services'),
    ('Training Package', 'TRN-001', 199.00, 'Services'),
    ('Enterprise License', 'LIC-001', 999.00, 'Software');

-- Sample data: Orders
INSERT INTO orders (customer_id, status, total_amount, order_date, shipped_at) VALUES
    (1, 'delivered', 398.00, NOW() - INTERVAL '30 days', NOW() - INTERVAL '25 days'),
    (1, 'delivered', 999.00, NOW() - INTERVAL '15 days', NOW() - INTERVAL '10 days'),
    (2, 'shipped', 299.00, NOW() - INTERVAL '5 days', NOW() - INTERVAL '2 days'),
    (3, 'processing', 598.00, NOW() - INTERVAL '2 days', NULL),
    (4, 'pending', 199.00, NOW() - INTERVAL '1 day', NULL),
    (5, 'delivered', 1498.00, NOW() - INTERVAL '45 days', NOW() - INTERVAL '40 days');

-- Sample data: Order items
INSERT INTO order_items (order_id, product_id, quantity, unit_price) VALUES
    (1, 1, 1, 299.00),
    (1, 2, 1, 99.00),
    (2, 5, 1, 999.00),
    (3, 1, 1, 299.00),
    (4, 1, 2, 299.00),
    (5, 4, 1, 199.00),
    (6, 5, 1, 999.00),
    (6, 3, 1, 499.00);

-- Useful views for testing
CREATE OR REPLACE VIEW order_summary AS
SELECT 
    o.id AS order_id,
    c.name AS customer_name,
    c.company,
    o.status,
    o.total_amount,
    o.order_date,
    COUNT(oi.id) AS item_count
FROM orders o
JOIN customers c ON o.customer_id = c.id
LEFT JOIN order_items oi ON o.id = oi.order_id
GROUP BY o.id, c.name, c.company, o.status, o.total_amount, o.order_date;

-- Grant permissions (adjust as needed)
-- GRANT SELECT ON ALL TABLES IN SCHEMA public TO prismiq_readonly;
