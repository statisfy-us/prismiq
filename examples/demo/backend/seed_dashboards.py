"""
Dashboard Seeding for Prismiq Demo.

Creates default dashboards with sample widgets showcasing
various chart types and query capabilities.
"""

from __future__ import annotations

import sys
import os

# Add the packages/python directory to path for development
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../../../packages/python"))

from prismiq import (
    AggregationType,
    ColumnSelection,
    DashboardCreate,
    DashboardFilter,
    DashboardFilterType,
    DashboardStore,
    DashboardUpdate,
    FilterDefinition,
    FilterOperator,
    GroupByDefinition,
    JoinDefinition,
    JoinType,
    QueryDefinition,
    QueryTable,
    SortDefinition,
    SortDirection,
    WidgetCreate,
    WidgetPosition,
    WidgetType,
)


async def seed_dashboards(store: DashboardStore) -> None:
    """
    Seed default dashboards into the dashboard store.

    Creates two dashboards:
    1. Sales Overview - Key business metrics and charts
    2. Product Analytics - Product performance analysis
    """
    # Check if dashboards already exist
    existing = await store.list_dashboards()
    existing_ids = {d.id for d in existing}

    if "sales-overview" not in existing_ids:
        await create_sales_overview_dashboard(store)

    if "product-analytics" not in existing_ids:
        await create_product_analytics_dashboard(store)


async def create_sales_overview_dashboard(store: DashboardStore) -> None:
    """Create the Sales Overview dashboard."""
    print("  Creating Sales Overview dashboard...")

    # Create the dashboard
    dashboard = await store.create_dashboard(
        DashboardCreate(
            name="Sales Overview",
            description="Key business metrics and sales performance",
        )
    )

    # Override ID to use a predictable value
    # Note: In a real app, you'd use the auto-generated ID
    # For demo purposes, we manually set it via internal update

    # Add dashboard-level filters
    await store.update_dashboard(
        dashboard.id,
        DashboardUpdate(
            filters=[
                DashboardFilter(
                    id="date-range",
                    label="Date Range",
                    type=DashboardFilterType.DATE_RANGE,
                    field="order_date",
                    table="orders",
                ),
                DashboardFilter(
                    id="region-filter",
                    label="Region",
                    type=DashboardFilterType.SELECT,
                    field="region",
                    table="customers",
                    options=[
                        {"value": "North", "label": "North"},
                        {"value": "South", "label": "South"},
                        {"value": "East", "label": "East"},
                        {"value": "West", "label": "West"},
                    ],
                ),
            ]
        ),
    )

    # Widget 1: Total Revenue (metric)
    await store.add_widget(
        dashboard.id,
        WidgetCreate(
            type=WidgetType.METRIC,
            title="Total Revenue",
            position=WidgetPosition(x=0, y=0, w=3, h=2),
            query=QueryDefinition(
                tables=[QueryTable(id="o", name="orders")],
                columns=[
                    ColumnSelection(
                        table_id="o",
                        column="total_amount",
                        aggregation=AggregationType.SUM,
                        alias="revenue",
                    )
                ],
                filters=[
                    FilterDefinition(
                        table_id="o",
                        column="status",
                        operator=FilterOperator.EQ,
                        value="completed",
                    )
                ],
            ),
            config={
                "format": "currency",
                "prefix": "$",
            },
        ),
    )

    # Widget 2: Order Count (metric)
    await store.add_widget(
        dashboard.id,
        WidgetCreate(
            type=WidgetType.METRIC,
            title="Order Count",
            position=WidgetPosition(x=3, y=0, w=3, h=2),
            query=QueryDefinition(
                tables=[QueryTable(id="o", name="orders")],
                columns=[
                    ColumnSelection(
                        table_id="o",
                        column="id",
                        aggregation=AggregationType.COUNT,
                        alias="count",
                    )
                ],
            ),
            config={
                "format": "number",
            },
        ),
    )

    # Widget 3: Avg Order Value (metric)
    await store.add_widget(
        dashboard.id,
        WidgetCreate(
            type=WidgetType.METRIC,
            title="Avg Order Value",
            position=WidgetPosition(x=6, y=0, w=3, h=2),
            query=QueryDefinition(
                tables=[QueryTable(id="o", name="orders")],
                columns=[
                    ColumnSelection(
                        table_id="o",
                        column="total_amount",
                        aggregation=AggregationType.AVG,
                        alias="avg_order",
                    )
                ],
                filters=[
                    FilterDefinition(
                        table_id="o",
                        column="status",
                        operator=FilterOperator.EQ,
                        value="completed",
                    )
                ],
            ),
            config={
                "format": "currency",
                "prefix": "$",
                "decimals": 2,
            },
        ),
    )

    # Widget 4: Customer Count (metric)
    await store.add_widget(
        dashboard.id,
        WidgetCreate(
            type=WidgetType.METRIC,
            title="Customer Count",
            position=WidgetPosition(x=9, y=0, w=3, h=2),
            query=QueryDefinition(
                tables=[QueryTable(id="c", name="customers")],
                columns=[
                    ColumnSelection(
                        table_id="c",
                        column="id",
                        aggregation=AggregationType.COUNT,
                        alias="count",
                    )
                ],
            ),
            config={
                "format": "number",
            },
        ),
    )

    # Widget 5: Revenue by Region (bar chart)
    await store.add_widget(
        dashboard.id,
        WidgetCreate(
            type=WidgetType.BAR_CHART,
            title="Revenue by Region",
            position=WidgetPosition(x=0, y=2, w=6, h=4),
            query=QueryDefinition(
                tables=[
                    QueryTable(id="o", name="orders"),
                    QueryTable(id="c", name="customers"),
                ],
                joins=[
                    JoinDefinition(
                        from_table_id="o",
                        from_column="customer_id",
                        to_table_id="c",
                        to_column="id",
                        join_type=JoinType.INNER,
                    )
                ],
                columns=[
                    ColumnSelection(
                        table_id="c",
                        column="region",
                        alias="region",
                    ),
                    ColumnSelection(
                        table_id="o",
                        column="total_amount",
                        aggregation=AggregationType.SUM,
                        alias="revenue",
                    ),
                ],
                group_by=[
                    GroupByDefinition(table_id="c", column="region"),
                ],
            ),
            config={
                "xField": "region",
                "yField": "revenue",
                "showLabels": True,
            },
        ),
    )

    # Widget 6: Sales by Category (pie chart)
    await store.add_widget(
        dashboard.id,
        WidgetCreate(
            type=WidgetType.PIE_CHART,
            title="Sales by Category",
            position=WidgetPosition(x=6, y=2, w=6, h=4),
            query=QueryDefinition(
                tables=[
                    QueryTable(id="oi", name="order_items"),
                    QueryTable(id="p", name="products"),
                ],
                joins=[
                    JoinDefinition(
                        from_table_id="oi",
                        from_column="product_id",
                        to_table_id="p",
                        to_column="id",
                        join_type=JoinType.INNER,
                    )
                ],
                columns=[
                    ColumnSelection(
                        table_id="p",
                        column="category",
                        alias="category",
                    ),
                    ColumnSelection(
                        table_id="oi",
                        column="unit_price",
                        aggregation=AggregationType.SUM,
                        alias="sales",
                    ),
                ],
                group_by=[
                    GroupByDefinition(table_id="p", column="category"),
                ],
            ),
            config={
                "nameField": "category",
                "valueField": "sales",
                "showLabels": True,
                "showPercent": True,
            },
        ),
    )

    # Widget 7: Daily Revenue (line chart)
    await store.add_widget(
        dashboard.id,
        WidgetCreate(
            type=WidgetType.LINE_CHART,
            title="Daily Revenue",
            position=WidgetPosition(x=0, y=6, w=8, h=4),
            query=QueryDefinition(
                tables=[QueryTable(id="o", name="orders")],
                columns=[
                    ColumnSelection(
                        table_id="o",
                        column="order_date",
                        alias="date",
                    ),
                    ColumnSelection(
                        table_id="o",
                        column="total_amount",
                        aggregation=AggregationType.SUM,
                        alias="revenue",
                    ),
                ],
                filters=[
                    FilterDefinition(
                        table_id="o",
                        column="status",
                        operator=FilterOperator.EQ,
                        value="completed",
                    )
                ],
                group_by=[
                    GroupByDefinition(table_id="o", column="order_date"),
                ],
                order_by=[
                    SortDefinition(
                        table_id="o",
                        column="order_date",
                        direction=SortDirection.ASC,
                    )
                ],
            ),
            config={
                "xField": "date",
                "yField": "revenue",
                "smooth": True,
                "showArea": True,
            },
        ),
    )

    # Widget 8: Top Customers (table)
    await store.add_widget(
        dashboard.id,
        WidgetCreate(
            type=WidgetType.TABLE,
            title="Top Customers",
            position=WidgetPosition(x=8, y=6, w=4, h=4),
            query=QueryDefinition(
                tables=[
                    QueryTable(id="o", name="orders"),
                    QueryTable(id="c", name="customers"),
                ],
                joins=[
                    JoinDefinition(
                        from_table_id="o",
                        from_column="customer_id",
                        to_table_id="c",
                        to_column="id",
                        join_type=JoinType.INNER,
                    )
                ],
                columns=[
                    ColumnSelection(
                        table_id="c",
                        column="name",
                        alias="customer",
                    ),
                    ColumnSelection(
                        table_id="o",
                        column="total_amount",
                        aggregation=AggregationType.SUM,
                        alias="total_spend",
                    ),
                ],
                group_by=[
                    GroupByDefinition(table_id="c", column="id"),
                    GroupByDefinition(table_id="c", column="name"),
                ],
                limit=10,
            ),
            config={
                "columns": [
                    {"field": "customer", "header": "Customer"},
                    {
                        "field": "total_spend",
                        "header": "Total Spend",
                        "format": "currency",
                    },
                ],
            },
        ),
    )

    print(f"    Created dashboard with ID: {dashboard.id}")


async def create_product_analytics_dashboard(store: DashboardStore) -> None:
    """Create the Product Analytics dashboard."""
    print("  Creating Product Analytics dashboard...")

    # Create the dashboard
    dashboard = await store.create_dashboard(
        DashboardCreate(
            name="Product Analytics",
            description="Product performance and inventory analysis",
        )
    )

    # Add category filter
    await store.update_dashboard(
        dashboard.id,
        DashboardUpdate(
            filters=[
                DashboardFilter(
                    id="category-filter",
                    label="Category",
                    type=DashboardFilterType.MULTI_SELECT,
                    field="category",
                    table="products",
                    options=[
                        {"value": "Electronics", "label": "Electronics"},
                        {"value": "Clothing", "label": "Clothing"},
                        {"value": "Home", "label": "Home"},
                        {"value": "Sports", "label": "Sports"},
                    ],
                ),
            ]
        ),
    )

    # Widget 1: Total Products (metric)
    await store.add_widget(
        dashboard.id,
        WidgetCreate(
            type=WidgetType.METRIC,
            title="Total Products",
            position=WidgetPosition(x=0, y=0, w=3, h=2),
            query=QueryDefinition(
                tables=[QueryTable(id="p", name="products")],
                columns=[
                    ColumnSelection(
                        table_id="p",
                        column="id",
                        aggregation=AggregationType.COUNT,
                        alias="count",
                    )
                ],
            ),
            config={"format": "number"},
        ),
    )

    # Widget 2: Average Price (metric)
    await store.add_widget(
        dashboard.id,
        WidgetCreate(
            type=WidgetType.METRIC,
            title="Avg Price",
            position=WidgetPosition(x=3, y=0, w=3, h=2),
            query=QueryDefinition(
                tables=[QueryTable(id="p", name="products")],
                columns=[
                    ColumnSelection(
                        table_id="p",
                        column="price",
                        aggregation=AggregationType.AVG,
                        alias="avg_price",
                    )
                ],
            ),
            config={
                "format": "currency",
                "prefix": "$",
                "decimals": 2,
            },
        ),
    )

    # Widget 3: Total Stock (metric)
    await store.add_widget(
        dashboard.id,
        WidgetCreate(
            type=WidgetType.METRIC,
            title="Total Stock",
            position=WidgetPosition(x=6, y=0, w=3, h=2),
            query=QueryDefinition(
                tables=[QueryTable(id="p", name="products")],
                columns=[
                    ColumnSelection(
                        table_id="p",
                        column="stock_quantity",
                        aggregation=AggregationType.SUM,
                        alias="stock",
                    )
                ],
            ),
            config={"format": "number"},
        ),
    )

    # Widget 4: Avg Margin (metric)
    await store.add_widget(
        dashboard.id,
        WidgetCreate(
            type=WidgetType.METRIC,
            title="Avg Margin %",
            position=WidgetPosition(x=9, y=0, w=3, h=2),
            query=QueryDefinition(
                tables=[QueryTable(id="p", name="products")],
                columns=[
                    ColumnSelection(
                        table_id="p",
                        column="price",
                        aggregation=AggregationType.AVG,
                        alias="avg_price",
                    ),
                    ColumnSelection(
                        table_id="p",
                        column="cost",
                        aggregation=AggregationType.AVG,
                        alias="avg_cost",
                    ),
                ],
            ),
            config={
                "format": "percent",
                "calculation": "(avg_price - avg_cost) / avg_price * 100",
            },
        ),
    )

    # Widget 5: Top Selling Products (bar chart)
    await store.add_widget(
        dashboard.id,
        WidgetCreate(
            type=WidgetType.BAR_CHART,
            title="Top Selling Products",
            position=WidgetPosition(x=0, y=2, w=6, h=4),
            query=QueryDefinition(
                tables=[
                    QueryTable(id="oi", name="order_items"),
                    QueryTable(id="p", name="products"),
                ],
                joins=[
                    JoinDefinition(
                        from_table_id="oi",
                        from_column="product_id",
                        to_table_id="p",
                        to_column="id",
                        join_type=JoinType.INNER,
                    )
                ],
                columns=[
                    ColumnSelection(
                        table_id="p",
                        column="name",
                        alias="product",
                    ),
                    ColumnSelection(
                        table_id="oi",
                        column="quantity",
                        aggregation=AggregationType.SUM,
                        alias="units_sold",
                    ),
                ],
                group_by=[
                    GroupByDefinition(table_id="p", column="name"),
                ],
                limit=10,
            ),
            config={
                "xField": "product",
                "yField": "units_sold",
                "horizontal": True,
            },
        ),
    )

    # Widget 6: Revenue by Category (area chart)
    await store.add_widget(
        dashboard.id,
        WidgetCreate(
            type=WidgetType.AREA_CHART,
            title="Revenue by Category Over Time",
            position=WidgetPosition(x=6, y=2, w=6, h=4),
            query=QueryDefinition(
                tables=[
                    QueryTable(id="o", name="orders"),
                    QueryTable(id="oi", name="order_items"),
                    QueryTable(id="p", name="products"),
                ],
                joins=[
                    JoinDefinition(
                        from_table_id="oi",
                        from_column="order_id",
                        to_table_id="o",
                        to_column="id",
                        join_type=JoinType.INNER,
                    ),
                    JoinDefinition(
                        from_table_id="oi",
                        from_column="product_id",
                        to_table_id="p",
                        to_column="id",
                        join_type=JoinType.INNER,
                    ),
                ],
                columns=[
                    ColumnSelection(
                        table_id="o",
                        column="order_date",
                        alias="date",
                    ),
                    ColumnSelection(
                        table_id="p",
                        column="category",
                        alias="category",
                    ),
                    ColumnSelection(
                        table_id="oi",
                        column="unit_price",
                        aggregation=AggregationType.SUM,
                        alias="revenue",
                    ),
                ],
                group_by=[
                    GroupByDefinition(table_id="o", column="order_date"),
                    GroupByDefinition(table_id="p", column="category"),
                ],
                order_by=[
                    SortDefinition(
                        table_id="o", column="order_date", direction=SortDirection.ASC
                    ),
                ],
            ),
            config={
                "xField": "date",
                "yField": "revenue",
                "seriesField": "category",
                "stacked": True,
            },
        ),
    )

    # Widget 7: Product Price Distribution (scatter chart)
    await store.add_widget(
        dashboard.id,
        WidgetCreate(
            type=WidgetType.SCATTER_CHART,
            title="Price vs Cost by Category",
            position=WidgetPosition(x=0, y=6, w=6, h=4),
            query=QueryDefinition(
                tables=[QueryTable(id="p", name="products")],
                columns=[
                    ColumnSelection(
                        table_id="p",
                        column="price",
                        alias="price",
                    ),
                    ColumnSelection(
                        table_id="p",
                        column="cost",
                        alias="cost",
                    ),
                    ColumnSelection(
                        table_id="p",
                        column="category",
                        alias="category",
                    ),
                    ColumnSelection(
                        table_id="p",
                        column="name",
                        alias="name",
                    ),
                ],
            ),
            config={
                "xField": "cost",
                "yField": "price",
                "colorField": "category",
                "tooltipField": "name",
            },
        ),
    )

    # Widget 8: Stock by Category (table)
    await store.add_widget(
        dashboard.id,
        WidgetCreate(
            type=WidgetType.TABLE,
            title="Inventory by Category",
            position=WidgetPosition(x=6, y=6, w=6, h=4),
            query=QueryDefinition(
                tables=[QueryTable(id="p", name="products")],
                columns=[
                    ColumnSelection(
                        table_id="p",
                        column="category",
                        alias="category",
                    ),
                    ColumnSelection(
                        table_id="p",
                        column="id",
                        aggregation=AggregationType.COUNT,
                        alias="products",
                    ),
                    ColumnSelection(
                        table_id="p",
                        column="stock_quantity",
                        aggregation=AggregationType.SUM,
                        alias="total_stock",
                    ),
                    ColumnSelection(
                        table_id="p",
                        column="stock_quantity",
                        aggregation=AggregationType.AVG,
                        alias="avg_stock",
                    ),
                ],
                group_by=[
                    GroupByDefinition(table_id="p", column="category"),
                ],
            ),
            config={
                "columns": [
                    {"field": "category", "header": "Category"},
                    {"field": "products", "header": "Products"},
                    {"field": "total_stock", "header": "Total Stock"},
                    {"field": "avg_stock", "header": "Avg Stock", "decimals": 0},
                ],
            },
        ),
    )

    print(f"    Created dashboard with ID: {dashboard.id}")


# Allow running directly for testing
if __name__ == "__main__":
    import asyncio
    from prismiq import InMemoryDashboardStore

    async def test_seed():
        store = InMemoryDashboardStore()
        await seed_dashboards(store)
        dashboards = await store.list_dashboards()
        print(f"\nCreated {len(dashboards)} dashboards:")
        for d in dashboards:
            print(f"  - {d.name} ({len(d.widgets)} widgets)")

    asyncio.run(test_seed())
