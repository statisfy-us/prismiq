"""Tests for the metrics module."""

from __future__ import annotations

import pytest

from prismiq.metrics import (
    DEFAULT_BUCKETS,
    HistogramValue,
    Metrics,
    MetricValue,
    Timer,
    create_metrics_router,
    metrics,
    record_cache_hit,
    record_query_execution,
    record_request,
    set_active_connections,
)

# ============================================================================
# MetricValue Tests
# ============================================================================


class TestMetricValue:
    """Tests for MetricValue dataclass."""

    def test_creates_with_required_fields(self) -> None:
        """MetricValue can be created with name and value."""
        metric = MetricValue(name="test_metric", value=42.0)

        assert metric.name == "test_metric"
        assert metric.value == 42.0
        assert metric.labels == {}
        assert metric.metric_type == "gauge"

    def test_creates_with_labels(self) -> None:
        """MetricValue can be created with labels."""
        metric = MetricValue(
            name="test_metric",
            value=42.0,
            labels={"method": "GET", "status": "200"},
            metric_type="counter",
        )

        assert metric.labels == {"method": "GET", "status": "200"}
        assert metric.metric_type == "counter"


class TestHistogramValue:
    """Tests for HistogramValue dataclass."""

    def test_default_values(self) -> None:
        """HistogramValue has sensible defaults."""
        hist = HistogramValue()

        assert hist.sum == 0.0
        assert hist.count == 0
        assert hist.buckets == {}

    def test_with_buckets(self) -> None:
        """HistogramValue can be created with buckets."""
        hist = HistogramValue(
            sum=100.0,
            count=5,
            buckets={10.0: 2, 50.0: 4, 100.0: 5},
        )

        assert hist.sum == 100.0
        assert hist.count == 5
        assert hist.buckets[50.0] == 4


# ============================================================================
# Counter Tests
# ============================================================================


class TestCounters:
    """Tests for counter metrics."""

    @pytest.fixture
    def fresh_metrics(self) -> Metrics:
        """Create a fresh metrics instance."""
        return Metrics()

    def test_inc_counter_basic(self, fresh_metrics: Metrics) -> None:
        """Counter can be incremented."""
        fresh_metrics.inc_counter("requests")
        fresh_metrics.inc_counter("requests")
        fresh_metrics.inc_counter("requests")

        assert fresh_metrics.get_counter("requests") == 3.0

    def test_inc_counter_with_value(self, fresh_metrics: Metrics) -> None:
        """Counter can be incremented by a specific value."""
        fresh_metrics.inc_counter("bytes", value=1024)
        fresh_metrics.inc_counter("bytes", value=2048)

        assert fresh_metrics.get_counter("bytes") == 3072.0

    def test_inc_counter_with_labels(self, fresh_metrics: Metrics) -> None:
        """Counter with labels tracks separately."""
        fresh_metrics.inc_counter("requests", method="GET", status="200")
        fresh_metrics.inc_counter("requests", method="POST", status="201")
        fresh_metrics.inc_counter("requests", method="GET", status="200")

        assert fresh_metrics.get_counter("requests", method="GET", status="200") == 2.0
        assert fresh_metrics.get_counter("requests", method="POST", status="201") == 1.0

    def test_inc_counter_negative_raises(self, fresh_metrics: Metrics) -> None:
        """Counter cannot be decremented."""
        with pytest.raises(ValueError, match="non-negative"):
            fresh_metrics.inc_counter("requests", value=-1)

    def test_get_counter_unset(self, fresh_metrics: Metrics) -> None:
        """Unset counter returns 0."""
        assert fresh_metrics.get_counter("nonexistent") == 0.0

    def test_register_counter(self, fresh_metrics: Metrics) -> None:
        """Counter can be registered with help text."""
        fresh_metrics.register_counter("test", "A test counter")

        fresh_metrics.inc_counter("test")
        output = fresh_metrics.format_prometheus()

        assert "HELP prismiq_test A test counter" in output


# ============================================================================
# Gauge Tests
# ============================================================================


class TestGauges:
    """Tests for gauge metrics."""

    @pytest.fixture
    def fresh_metrics(self) -> Metrics:
        """Create a fresh metrics instance."""
        return Metrics()

    def test_set_gauge_basic(self, fresh_metrics: Metrics) -> None:
        """Gauge can be set."""
        fresh_metrics.set_gauge("temperature", 72.5)

        assert fresh_metrics.get_gauge("temperature") == 72.5

    def test_set_gauge_overwrite(self, fresh_metrics: Metrics) -> None:
        """Gauge can be overwritten."""
        fresh_metrics.set_gauge("temperature", 72.5)
        fresh_metrics.set_gauge("temperature", 68.0)

        assert fresh_metrics.get_gauge("temperature") == 68.0

    def test_set_gauge_with_labels(self, fresh_metrics: Metrics) -> None:
        """Gauge with labels tracks separately."""
        fresh_metrics.set_gauge("temperature", 72.5, location="office")
        fresh_metrics.set_gauge("temperature", 68.0, location="home")

        assert fresh_metrics.get_gauge("temperature", location="office") == 72.5
        assert fresh_metrics.get_gauge("temperature", location="home") == 68.0

    def test_get_gauge_unset(self, fresh_metrics: Metrics) -> None:
        """Unset gauge returns None."""
        assert fresh_metrics.get_gauge("nonexistent") is None

    def test_inc_gauge(self, fresh_metrics: Metrics) -> None:
        """Gauge can be incremented."""
        fresh_metrics.set_gauge("connections", 5.0)
        fresh_metrics.inc_gauge("connections", 3.0)

        assert fresh_metrics.get_gauge("connections") == 8.0

    def test_dec_gauge(self, fresh_metrics: Metrics) -> None:
        """Gauge can be decremented."""
        fresh_metrics.set_gauge("connections", 5.0)
        fresh_metrics.dec_gauge("connections", 2.0)

        assert fresh_metrics.get_gauge("connections") == 3.0

    def test_register_gauge(self, fresh_metrics: Metrics) -> None:
        """Gauge can be registered with help text."""
        fresh_metrics.register_gauge("test", "A test gauge")

        fresh_metrics.set_gauge("test", 42.0)
        output = fresh_metrics.format_prometheus()

        assert "HELP prismiq_test A test gauge" in output


# ============================================================================
# Histogram Tests
# ============================================================================


class TestHistograms:
    """Tests for histogram metrics."""

    @pytest.fixture
    def fresh_metrics(self) -> Metrics:
        """Create a fresh metrics instance."""
        return Metrics()

    def test_observe_histogram_basic(self, fresh_metrics: Metrics) -> None:
        """Histogram can record observations."""
        fresh_metrics.observe_histogram("latency", 10.0)
        fresh_metrics.observe_histogram("latency", 20.0)
        fresh_metrics.observe_histogram("latency", 30.0)

        hist = fresh_metrics.get_histogram("latency")
        assert hist is not None
        assert hist.count == 3
        assert hist.sum == 60.0

    def test_observe_histogram_with_labels(self, fresh_metrics: Metrics) -> None:
        """Histogram with labels tracks separately."""
        fresh_metrics.observe_histogram("latency", 10.0, endpoint="/api")
        fresh_metrics.observe_histogram("latency", 20.0, endpoint="/health")

        api_hist = fresh_metrics.get_histogram("latency", endpoint="/api")
        health_hist = fresh_metrics.get_histogram("latency", endpoint="/health")

        assert api_hist is not None
        assert api_hist.count == 1
        assert health_hist is not None
        assert health_hist.count == 1

    def test_histogram_buckets(self, fresh_metrics: Metrics) -> None:
        """Histogram tracks bucket counts."""
        # Use default buckets
        fresh_metrics.observe_histogram("latency", 5.0)
        fresh_metrics.observe_histogram("latency", 15.0)
        fresh_metrics.observe_histogram("latency", 30.0)
        fresh_metrics.observe_histogram("latency", 100.0)

        hist = fresh_metrics.get_histogram("latency")
        assert hist is not None

        # 5ms value should be in 5ms bucket and all higher
        assert hist.buckets[5.0] == 1

        # 15ms value should be in 25ms bucket and higher
        assert hist.buckets[10.0] == 1
        assert hist.buckets[25.0] == 2

        # 30ms value should be in 50ms bucket and higher
        assert hist.buckets[50.0] == 3

        # 100ms value should be in 100ms bucket
        assert hist.buckets[100.0] == 4

    def test_get_histogram_unset(self, fresh_metrics: Metrics) -> None:
        """Unset histogram returns None."""
        assert fresh_metrics.get_histogram("nonexistent") is None

    def test_register_histogram_custom_buckets(self, fresh_metrics: Metrics) -> None:
        """Histogram can use custom buckets."""
        fresh_metrics.register_histogram(
            "custom",
            "Custom histogram",
            buckets=(1.0, 5.0, 10.0),
        )

        fresh_metrics.observe_histogram("custom", 3.0)

        hist = fresh_metrics.get_histogram("custom")
        assert hist is not None
        assert 1.0 in hist.buckets
        assert 5.0 in hist.buckets
        assert 10.0 in hist.buckets
        assert float("inf") in hist.buckets  # Always added


# ============================================================================
# Prometheus Format Tests
# ============================================================================


class TestPrometheusFormat:
    """Tests for Prometheus exposition format output."""

    @pytest.fixture
    def fresh_metrics(self) -> Metrics:
        """Create a fresh metrics instance."""
        return Metrics()

    def test_format_empty_metrics(self, fresh_metrics: Metrics) -> None:
        """Empty metrics produces empty output."""
        output = fresh_metrics.format_prometheus()
        assert output == ""

    def test_format_counter(self, fresh_metrics: Metrics) -> None:
        """Counter is formatted correctly."""
        fresh_metrics.inc_counter("requests")
        output = fresh_metrics.format_prometheus()

        assert "# TYPE prismiq_requests counter" in output
        assert "prismiq_requests 1" in output

    def test_format_counter_with_labels(self, fresh_metrics: Metrics) -> None:
        """Counter with labels is formatted correctly."""
        fresh_metrics.inc_counter("requests", method="GET", status="200")
        output = fresh_metrics.format_prometheus()

        assert "prismiq_requests{" in output
        assert 'method="GET"' in output
        assert 'status="200"' in output

    def test_format_gauge(self, fresh_metrics: Metrics) -> None:
        """Gauge is formatted correctly."""
        fresh_metrics.set_gauge("temperature", 72.5)
        output = fresh_metrics.format_prometheus()

        assert "# TYPE prismiq_temperature gauge" in output
        assert "prismiq_temperature 72.5" in output

    def test_format_histogram(self, fresh_metrics: Metrics) -> None:
        """Histogram is formatted correctly."""
        fresh_metrics.register_histogram("latency", buckets=(10.0, 50.0, 100.0))
        fresh_metrics.observe_histogram("latency", 25.0)

        output = fresh_metrics.format_prometheus()

        assert "# TYPE prismiq_latency histogram" in output
        assert 'prismiq_latency_bucket{le="10"}' in output
        assert 'prismiq_latency_bucket{le="50"}' in output
        assert 'prismiq_latency_bucket{le="100"}' in output
        assert 'prismiq_latency_bucket{le="+Inf"}' in output
        assert "prismiq_latency_sum 25" in output
        assert "prismiq_latency_count 1" in output

    def test_format_includes_help(self, fresh_metrics: Metrics) -> None:
        """HELP lines are included when registered."""
        fresh_metrics.register_counter("test", "Test counter help")
        fresh_metrics.inc_counter("test")
        output = fresh_metrics.format_prometheus()

        assert "# HELP prismiq_test Test counter help" in output

    def test_format_integer_values(self, fresh_metrics: Metrics) -> None:
        """Integer values are formatted without decimals."""
        fresh_metrics.inc_counter("requests", value=10)
        output = fresh_metrics.format_prometheus()

        assert "prismiq_requests 10" in output

    def test_format_float_values(self, fresh_metrics: Metrics) -> None:
        """Float values are preserved."""
        fresh_metrics.set_gauge("temperature", 72.5)
        output = fresh_metrics.format_prometheus()

        assert "72.5" in output


# ============================================================================
# Reset Tests
# ============================================================================


class TestReset:
    """Tests for metrics reset."""

    def test_reset_clears_all(self) -> None:
        """Reset clears all metrics."""
        m = Metrics()

        m.inc_counter("requests")
        m.set_gauge("connections", 5.0)
        m.observe_histogram("latency", 10.0)

        m.reset()

        assert m.get_counter("requests") == 0.0
        assert m.get_gauge("connections") is None
        assert m.get_histogram("latency") is None


# ============================================================================
# Convenience Function Tests
# ============================================================================


class TestConvenienceFunctions:
    """Tests for convenience functions."""

    @pytest.fixture(autouse=True)
    def reset_global_metrics(self) -> None:
        """Reset global metrics before each test."""
        metrics.reset()

    def test_record_query_execution(self) -> None:
        """record_query_execution records counter and histogram."""
        record_query_execution(25.5, "success")

        assert metrics.get_counter("queries_total", status="success") == 1.0

    def test_record_cache_hit(self) -> None:
        """record_cache_hit records cache hits/misses."""
        record_cache_hit(True)
        record_cache_hit(True)
        record_cache_hit(False)

        assert metrics.get_counter("cache_total", result="hit") == 2.0
        assert metrics.get_counter("cache_total", result="miss") == 1.0

    def test_record_request(self) -> None:
        """record_request records request metrics."""
        record_request("/api/query", "POST", 200, 125.5)

        assert (
            metrics.get_counter(
                "requests_total", endpoint="/api/query", method="POST", status="200"
            )
            == 1.0
        )

    def test_set_active_connections(self) -> None:
        """set_active_connections sets the gauge."""
        set_active_connections(10)

        assert metrics.get_gauge("active_connections") == 10.0


# ============================================================================
# Timer Tests
# ============================================================================


class TestTimer:
    """Tests for Timer context manager."""

    def test_timer_measures_duration(self) -> None:
        """Timer measures duration."""
        import time

        with Timer() as t:
            time.sleep(0.01)  # 10ms

        # Should be at least 10ms
        assert t.duration_ms >= 10.0
        # Should be less than 100ms (generous for CI)
        assert t.duration_ms < 100.0


# ============================================================================
# Router Tests
# ============================================================================


class TestMetricsRouter:
    """Tests for metrics router."""

    def test_create_metrics_router(self) -> None:
        """Router is created with /metrics endpoint."""
        from fastapi import FastAPI
        from fastapi.testclient import TestClient

        app = FastAPI()
        router = create_metrics_router()
        app.include_router(router)

        # Add a metric
        metrics.reset()
        metrics.inc_counter("test")

        client = TestClient(app)
        response = client.get("/metrics")

        assert response.status_code == 200
        assert response.headers["content-type"] == "text/plain; charset=utf-8"
        assert "prismiq_test" in response.text

    def test_metrics_endpoint_text_format(self) -> None:
        """Metrics endpoint returns text/plain."""
        from fastapi import FastAPI
        from fastapi.testclient import TestClient

        app = FastAPI()
        app.include_router(create_metrics_router())

        client = TestClient(app)
        response = client.get("/metrics")

        assert "text/plain" in response.headers["content-type"]


# ============================================================================
# Default Buckets Tests
# ============================================================================


class TestDefaultBuckets:
    """Tests for default histogram buckets."""

    def test_default_buckets_defined(self) -> None:
        """Default buckets are defined."""
        assert DEFAULT_BUCKETS is not None
        assert len(DEFAULT_BUCKETS) > 0

    def test_default_buckets_includes_inf(self) -> None:
        """Default buckets include +Inf."""
        assert float("inf") in DEFAULT_BUCKETS

    def test_default_buckets_ascending(self) -> None:
        """Default buckets are in ascending order."""
        for i in range(len(DEFAULT_BUCKETS) - 1):
            assert DEFAULT_BUCKETS[i] < DEFAULT_BUCKETS[i + 1]
