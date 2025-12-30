-- Prismiq metadata tables
-- Created in customer's database alongside their data tables

-- Dashboards
CREATE TABLE IF NOT EXISTS prismiq_dashboards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    layout JSONB NOT NULL DEFAULT '{"columns": 12, "rowHeight": 50, "margin": [10, 10]}',
    filters JSONB NOT NULL DEFAULT '[]',
    owner_id VARCHAR(255),
    is_public BOOLEAN NOT NULL DEFAULT FALSE,
    allowed_viewers TEXT[] NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT unique_dashboard_name_per_tenant UNIQUE (tenant_id, name)
);

CREATE INDEX IF NOT EXISTS idx_dashboards_tenant_id ON prismiq_dashboards(tenant_id);
CREATE INDEX IF NOT EXISTS idx_dashboards_owner_id ON prismiq_dashboards(tenant_id, owner_id);

-- Widgets
CREATE TABLE IF NOT EXISTS prismiq_widgets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dashboard_id UUID NOT NULL REFERENCES prismiq_dashboards(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    query JSONB,  -- Null for text widgets
    position JSONB NOT NULL,  -- {x, y, w, h}
    config JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_widgets_dashboard_id ON prismiq_widgets(dashboard_id);

-- Schema configuration per tenant
CREATE TABLE IF NOT EXISTS prismiq_schema_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(255) NOT NULL UNIQUE,
    config JSONB NOT NULL DEFAULT '{}',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_schema_config_tenant ON prismiq_schema_config(tenant_id);

-- Saved queries for reuse
CREATE TABLE IF NOT EXISTS prismiq_saved_queries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    query JSONB NOT NULL,
    owner_id VARCHAR(255),
    is_shared BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT unique_query_name_per_tenant UNIQUE (tenant_id, name)
);

CREATE INDEX IF NOT EXISTS idx_saved_queries_tenant ON prismiq_saved_queries(tenant_id);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION prismiq_update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for auto-updating timestamps
DROP TRIGGER IF EXISTS prismiq_dashboards_updated ON prismiq_dashboards;
CREATE TRIGGER prismiq_dashboards_updated
    BEFORE UPDATE ON prismiq_dashboards
    FOR EACH ROW EXECUTE FUNCTION prismiq_update_timestamp();

DROP TRIGGER IF EXISTS prismiq_widgets_updated ON prismiq_widgets;
CREATE TRIGGER prismiq_widgets_updated
    BEFORE UPDATE ON prismiq_widgets
    FOR EACH ROW EXECUTE FUNCTION prismiq_update_timestamp();

DROP TRIGGER IF EXISTS prismiq_schema_config_updated ON prismiq_schema_config;
CREATE TRIGGER prismiq_schema_config_updated
    BEFORE UPDATE ON prismiq_schema_config
    FOR EACH ROW EXECUTE FUNCTION prismiq_update_timestamp();

DROP TRIGGER IF EXISTS prismiq_saved_queries_updated ON prismiq_saved_queries;
CREATE TRIGGER prismiq_saved_queries_updated
    BEFORE UPDATE ON prismiq_saved_queries
    FOR EACH ROW EXECUTE FUNCTION prismiq_update_timestamp();
