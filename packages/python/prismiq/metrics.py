"""Prometheus-compatible metrics for Prismiq.

This module provides a metrics collection system compatible with
Prometheus exposition format for monitoring and observability.
"""

from __future__ import annotations

import math
import time
from collections import defaultdict
from dataclasses import dataclass, field
from typing import TYPE_CHECKING, Any

from fastapi import APIRouter
from fastapi.responses import PlainTextResponse

if TYPE_CHECKING:
    pass


# ============================================================================
# Histogram Buckets
# ============================================================================

# Default histogram buckets for response times (in milliseconds)
DEFAULT_BUCKETS = (5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000, float("inf"))


# ============================================================================
# Metric Types
# ============================================================================


@dataclass
class MetricValue:
    """A single metric value with labels."""

    name: str
    """Metric name."""

    value: float
    """Metric value."""

    labels: dict[str, str] = field(default_factory=dict)
    """Labels for this metric."""

    metric_type: str = "gauge"
    """Type: 'counter', 'gauge', or 'histogram'."""


@dataclass
class HistogramValue:
    """Histogram metric with bucket counts."""

    sum: float = 0.0
    """Sum of all observed values."""

    count: int = 0
    """Number of observations."""

    buckets: dict[float, int] = field(default_factory=dict)
    """Bucket counts (upper bound -> count)."""


# ============================================================================
# Metrics Collector
# ============================================================================


class Metrics:
    """Prometheus-compatible metrics collector.

    Supports counters, gauges, and histograms with labels.
    Thread-safe through atomic operations on primitive types.

    Example:
        >>> metrics = Metrics()
        >>> metrics.inc_counter("http_requests_total", method="GET", status="200")
        >>> metrics.set_gauge("active_connections", 42)
        >>> metrics.observe_histogram("request_duration_ms", 125.5, endpoint="/api")
        >>> print(metrics.format_prometheus())
    """

    def __init__(self, prefix: str = "prismiq") -> None:
        """Initialize metrics collector.

        Args:
            prefix: Prefix for all metric names.
        """
        self._prefix = prefix
        self._counters: dict[str, float] = defaultdict(float)
        self._gauges: dict[str, float] = {}
        self._histograms: dict[str, HistogramValue] = {}
        self._histogram_buckets: dict[str, tuple[float, ...]] = {}

        # Track metric metadata for exposition
        self._counter_help: dict[str, str] = {}
        self._gauge_help: dict[str, str] = {}
        self._histogram_help: dict[str, str] = {}

    def _make_key(self, name: str, labels: dict[str, str]) -> str:
        """Create a unique key from name and labels."""
        if not labels:
            return name

        sorted_labels = sorted(labels.items())
        label_str = ",".join(f'{k}="{v}"' for k, v in sorted_labels)
        return f"{name}{{{label_str}}}"

    def _parse_key(self, key: str) -> tuple[str, str]:
        """Parse a key back into name and label string."""
        if "{" not in key:
            return key, ""

        name = key.split("{")[0]
        labels_part = key[key.index("{") + 1 : key.rindex("}")]
        return name, labels_part

    # ========================================================================
    # Counter Operations
    # ========================================================================

    def register_counter(self, name: str, help_text: str = "") -> None:
        """Register a counter metric.

        Args:
            name: Metric name (without prefix).
            help_text: Description for the HELP line.
        """
        full_name = f"{self._prefix}_{name}"
        self._counter_help[full_name] = help_text

    def inc_counter(self, name: str, value: float = 1.0, **labels: str) -> None:
        """Increment a counter.

        Args:
            name: Counter name (without prefix).
            value: Amount to increment (must be positive).
            **labels: Label key-value pairs.
        """
        if value < 0:
            raise ValueError("Counter increment must be non-negative")

        full_name = f"{self._prefix}_{name}"
        key = self._make_key(full_name, labels)
        self._counters[key] += value

    def get_counter(self, name: str, **labels: str) -> float:
        """Get current counter value.

        Args:
            name: Counter name (without prefix).
            **labels: Label key-value pairs.

        Returns:
            Current counter value (0 if not set).
        """
        full_name = f"{self._prefix}_{name}"
        key = self._make_key(full_name, labels)
        return self._counters.get(key, 0.0)

    # ========================================================================
    # Gauge Operations
    # ========================================================================

    def register_gauge(self, name: str, help_text: str = "") -> None:
        """Register a gauge metric.

        Args:
            name: Metric name (without prefix).
            help_text: Description for the HELP line.
        """
        full_name = f"{self._prefix}_{name}"
        self._gauge_help[full_name] = help_text

    def set_gauge(self, name: str, value: float, **labels: str) -> None:
        """Set a gauge value.

        Args:
            name: Gauge name (without prefix).
            value: Value to set.
            **labels: Label key-value pairs.
        """
        full_name = f"{self._prefix}_{name}"
        key = self._make_key(full_name, labels)
        self._gauges[key] = value

    def get_gauge(self, name: str, **labels: str) -> float | None:
        """Get current gauge value.

        Args:
            name: Gauge name (without prefix).
            **labels: Label key-value pairs.

        Returns:
            Current gauge value, or None if not set.
        """
        full_name = f"{self._prefix}_{name}"
        key = self._make_key(full_name, labels)
        return self._gauges.get(key)

    def inc_gauge(self, name: str, value: float = 1.0, **labels: str) -> None:
        """Increment a gauge.

        Args:
            name: Gauge name (without prefix).
            value: Amount to increment.
            **labels: Label key-value pairs.
        """
        full_name = f"{self._prefix}_{name}"
        key = self._make_key(full_name, labels)
        self._gauges[key] = self._gauges.get(key, 0.0) + value

    def dec_gauge(self, name: str, value: float = 1.0, **labels: str) -> None:
        """Decrement a gauge.

        Args:
            name: Gauge name (without prefix).
            value: Amount to decrement.
            **labels: Label key-value pairs.
        """
        self.inc_gauge(name, -value, **labels)

    # ========================================================================
    # Histogram Operations
    # ========================================================================

    def register_histogram(
        self,
        name: str,
        help_text: str = "",
        buckets: tuple[float, ...] = DEFAULT_BUCKETS,
    ) -> None:
        """Register a histogram metric.

        Args:
            name: Metric name (without prefix).
            help_text: Description for the HELP line.
            buckets: Bucket boundaries (must include +Inf).
        """
        full_name = f"{self._prefix}_{name}"
        self._histogram_help[full_name] = help_text

        # Ensure +Inf is included
        if float("inf") not in buckets:
            buckets = (*buckets, float("inf"))

        self._histogram_buckets[full_name] = buckets

    def observe_histogram(self, name: str, value: float, **labels: str) -> None:
        """Record a histogram observation.

        Args:
            name: Histogram name (without prefix).
            value: Observed value.
            **labels: Label key-value pairs.
        """
        full_name = f"{self._prefix}_{name}"
        key = self._make_key(full_name, labels)

        if key not in self._histograms:
            buckets = self._histogram_buckets.get(full_name, DEFAULT_BUCKETS)
            self._histograms[key] = HistogramValue(
                buckets={b: 0 for b in buckets},
            )

        hist = self._histograms[key]
        hist.sum += value
        hist.count += 1

        # Update bucket counts
        for bucket in hist.buckets:
            if value <= bucket:
                hist.buckets[bucket] += 1

    def get_histogram(self, name: str, **labels: str) -> HistogramValue | None:
        """Get histogram data.

        Args:
            name: Histogram name (without prefix).
            **labels: Label key-value pairs.

        Returns:
            HistogramValue or None if not recorded.
        """
        full_name = f"{self._prefix}_{name}"
        key = self._make_key(full_name, labels)
        return self._histograms.get(key)

    # ========================================================================
    # Prometheus Format Output
    # ========================================================================

    def format_prometheus(self) -> str:
        """Format all metrics in Prometheus exposition format.

        Returns:
            Metrics in Prometheus text format.
        """
        lines: list[str] = []

        # Group metrics by name for TYPE and HELP lines
        counter_names: set[str] = set()
        gauge_names: set[str] = set()
        histogram_names: set[str] = set()

        # Counters
        for key in sorted(self._counters.keys()):
            name, labels = self._parse_key(key)

            if name not in counter_names:
                counter_names.add(name)
                if name in self._counter_help:
                    lines.append(f"# HELP {name} {self._counter_help[name]}")
                lines.append(f"# TYPE {name} counter")

            value = self._counters[key]
            if labels:
                lines.append(f"{name}{{{labels}}} {self._format_value(value)}")
            else:
                lines.append(f"{name} {self._format_value(value)}")

        # Gauges
        for key in sorted(self._gauges.keys()):
            name, labels = self._parse_key(key)

            if name not in gauge_names:
                gauge_names.add(name)
                if name in self._gauge_help:
                    lines.append(f"# HELP {name} {self._gauge_help[name]}")
                lines.append(f"# TYPE {name} gauge")

            value = self._gauges[key]
            if labels:
                lines.append(f"{name}{{{labels}}} {self._format_value(value)}")
            else:
                lines.append(f"{name} {self._format_value(value)}")

        # Histograms
        for key in sorted(self._histograms.keys()):
            name, labels = self._parse_key(key)

            if name not in histogram_names:
                histogram_names.add(name)
                if name in self._histogram_help:
                    lines.append(f"# HELP {name} {self._histogram_help[name]}")
                lines.append(f"# TYPE {name} histogram")

            hist = self._histograms[key]

            # Bucket lines
            for bucket in sorted(hist.buckets.keys()):
                count = hist.buckets[bucket]
                bucket_str = self._format_bucket_value(bucket)
                if labels:
                    lines.append(f'{name}_bucket{{{labels},le="{bucket_str}"}} {count}')
                else:
                    lines.append(f'{name}_bucket{{le="{bucket_str}"}} {count}')

            # Sum and count lines
            if labels:
                lines.append(f"{name}_sum{{{labels}}} {self._format_value(hist.sum)}")
                lines.append(f"{name}_count{{{labels}}} {hist.count}")
            else:
                lines.append(f"{name}_sum {self._format_value(hist.sum)}")
                lines.append(f"{name}_count {hist.count}")

        return "\n".join(lines)

    def _format_value(self, value: float) -> str:
        """Format a numeric value for Prometheus output."""
        if math.isinf(value):
            return "+Inf" if value > 0 else "-Inf"
        if math.isnan(value):
            return "NaN"
        if value == int(value):
            return str(int(value))
        return str(value)

    def _format_bucket_value(self, value: float) -> str:
        """Format a bucket boundary value for Prometheus output."""
        if math.isinf(value):
            return "+Inf"
        if value == int(value):
            return str(int(value))
        return str(value)

    # ========================================================================
    # Reset
    # ========================================================================

    def reset(self) -> None:
        """Reset all metrics to their initial state."""
        self._counters.clear()
        self._gauges.clear()
        self._histograms.clear()


# ============================================================================
# Global Metrics Instance
# ============================================================================

# Global metrics instance for the application
metrics = Metrics()

# Register default metrics
metrics.register_counter("queries_total", "Total number of queries executed")
metrics.register_counter("cache_total", "Cache hit/miss counts")
metrics.register_counter("requests_total", "Total HTTP requests")
metrics.register_histogram("query_duration_ms", "Query execution time in milliseconds")
metrics.register_histogram(
    "request_duration_ms", "HTTP request duration in milliseconds"
)
metrics.register_gauge("active_connections", "Number of active database connections")


# ============================================================================
# Convenience Functions
# ============================================================================


def record_query_execution(duration_ms: float, status: str = "success") -> None:
    """Record a query execution metric.

    Args:
        duration_ms: Query execution time in milliseconds.
        status: Query status ('success' or 'error').
    """
    metrics.inc_counter("queries_total", status=status)
    metrics.observe_histogram("query_duration_ms", duration_ms, status=status)


def record_cache_hit(hit: bool) -> None:
    """Record cache hit/miss.

    Args:
        hit: True if cache hit, False if miss.
    """
    result = "hit" if hit else "miss"
    metrics.inc_counter("cache_total", result=result)


def record_request(
    endpoint: str,
    method: str,
    status_code: int,
    duration_ms: float,
) -> None:
    """Record an HTTP request metric.

    Args:
        endpoint: Request endpoint path.
        method: HTTP method (GET, POST, etc.).
        status_code: Response status code.
        duration_ms: Request duration in milliseconds.
    """
    status = str(status_code)
    metrics.inc_counter(
        "requests_total",
        endpoint=endpoint,
        method=method,
        status=status,
    )
    metrics.observe_histogram(
        "request_duration_ms",
        duration_ms,
        endpoint=endpoint,
        method=method,
    )


def set_active_connections(count: int) -> None:
    """Set the active database connections gauge.

    Args:
        count: Number of active connections.
    """
    metrics.set_gauge("active_connections", float(count))


# ============================================================================
# Router Factory
# ============================================================================


def create_metrics_router() -> APIRouter:
    """Create a FastAPI router for the metrics endpoint.

    Returns:
        APIRouter with /metrics endpoint.

    Example:
        >>> from prismiq.metrics import create_metrics_router
        >>> app.include_router(create_metrics_router())
    """
    router = APIRouter(tags=["metrics"])

    @router.get("/metrics", response_class=PlainTextResponse)
    async def get_metrics() -> str:
        """Prometheus metrics endpoint.

        Returns metrics in Prometheus exposition format.
        """
        return metrics.format_prometheus()

    return router


# ============================================================================
# Metrics Context Manager
# ============================================================================


class Timer:
    """Context manager for timing operations.

    Example:
        >>> with Timer() as t:
        ...     do_something()
        >>> print(f"Took {t.duration_ms:.2f}ms")
    """

    def __init__(self) -> None:
        self._start: float = 0.0
        self._end: float = 0.0

    def __enter__(self) -> Timer:
        self._start = time.perf_counter()
        return self

    def __exit__(self, *args: Any) -> None:
        self._end = time.perf_counter()

    @property
    def duration_ms(self) -> float:
        """Get duration in milliseconds."""
        return (self._end - self._start) * 1000
