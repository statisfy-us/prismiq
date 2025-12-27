"""Tests for number formatting utilities."""

from __future__ import annotations

import math
from decimal import Decimal

import pytest

from prismiq.formatting import (
    NumberFormat,
    format_compact,
    format_currency,
    format_number,
    format_percent,
    parse_number,
)


class TestNumberFormat:
    """Tests for NumberFormat enum."""

    def test_all_formats_have_string_values(self) -> None:
        """Verify all formats are string enums."""
        for fmt in NumberFormat:
            assert isinstance(fmt.value, str)

    def test_format_count(self) -> None:
        """Verify the expected number of formats."""
        assert len(NumberFormat) == 5


class TestFormatNumber:
    """Tests for format_number function."""

    def test_none_returns_empty_string(self) -> None:
        """None value returns empty string."""
        assert format_number(None) == ""

    def test_nan_returns_na(self) -> None:
        """NaN returns N/A."""
        assert format_number(float("nan")) == "N/A"

    def test_infinity_returns_infinity(self) -> None:
        """Infinity values are handled."""
        assert format_number(float("inf")) == "Infinity"
        assert format_number(float("-inf")) == "-Infinity"

    def test_plain_format_integer(self) -> None:
        """PLAIN format for integers."""
        assert format_number(1234567, NumberFormat.PLAIN) == "1234567"

    def test_plain_format_float(self) -> None:
        """PLAIN format for floats."""
        assert format_number(1234.567, NumberFormat.PLAIN) == "1234.567"

    def test_compact_format(self) -> None:
        """COMPACT format applies compact notation."""
        assert format_number(1234567, NumberFormat.COMPACT) == "1.2M"

    def test_compact_format_below_threshold(self) -> None:
        """COMPACT format below threshold doesn't compact."""
        assert format_number(500, NumberFormat.COMPACT) == "500"

    def test_currency_format(self) -> None:
        """CURRENCY format adds symbol and separators."""
        assert format_number(1234.56, NumberFormat.CURRENCY) == "$1,234.56"

    def test_currency_format_custom_symbol(self) -> None:
        """CURRENCY format with custom symbol."""
        result = format_number(1234.56, NumberFormat.CURRENCY, currency_symbol="EUR")
        assert result == "EUR1,234.56"

    def test_percent_format(self) -> None:
        """PERCENT format converts ratio to percentage."""
        assert format_number(0.1234, NumberFormat.PERCENT) == "12.34%"

    def test_fixed_format(self) -> None:
        """FIXED format with specified decimals."""
        assert format_number(1234.5678, NumberFormat.FIXED, decimals=2) == "1,234.57"

    def test_fixed_format_zero_decimals(self) -> None:
        """FIXED format with zero decimals."""
        assert format_number(1234.5678, NumberFormat.FIXED, decimals=0) == "1,235"

    def test_decimal_input(self) -> None:
        """Decimal type is handled correctly."""
        assert format_number(Decimal("1234.56"), NumberFormat.CURRENCY) == "$1,234.56"

    def test_negative_numbers(self) -> None:
        """Negative numbers are handled correctly."""
        assert format_number(-1234.56, NumberFormat.CURRENCY) == "-$1,234.56"
        assert format_number(-0.1234, NumberFormat.PERCENT) == "-12.34%"


class TestFormatCompact:
    """Tests for format_compact function."""

    def test_below_thousand(self) -> None:
        """Numbers below 1000 are not compacted."""
        assert format_compact(500) == "500"
        assert format_compact(999.9) == "999.9"

    def test_thousands(self) -> None:
        """Numbers in thousands use K suffix."""
        assert format_compact(1000) == "1.0K"
        assert format_compact(1500) == "1.5K"
        assert format_compact(999_999) == "1000.0K"

    def test_millions(self) -> None:
        """Numbers in millions use M suffix."""
        assert format_compact(1_000_000) == "1.0M"
        assert format_compact(1_500_000) == "1.5M"
        assert format_compact(999_999_999) == "1000.0M"

    def test_billions(self) -> None:
        """Numbers in billions use B suffix."""
        assert format_compact(1_000_000_000) == "1.0B"
        assert format_compact(2_500_000_000) == "2.5B"

    def test_trillions(self) -> None:
        """Numbers in trillions use T suffix."""
        assert format_compact(1_000_000_000_000) == "1.0T"
        assert format_compact(5_000_000_000_000) == "5.0T"

    def test_negative_numbers(self) -> None:
        """Negative numbers are handled correctly."""
        assert format_compact(-1500) == "-1.5K"
        assert format_compact(-1_500_000) == "-1.5M"

    def test_custom_decimals(self) -> None:
        """Custom decimal places are respected."""
        assert format_compact(1234567, decimals=2) == "1.23M"
        assert format_compact(1234567, decimals=0) == "1M"

    def test_nan(self) -> None:
        """NaN returns N/A."""
        assert format_compact(float("nan")) == "N/A"

    def test_infinity(self) -> None:
        """Infinity is handled."""
        assert format_compact(float("inf")) == "Infinity"
        assert format_compact(float("-inf")) == "-Infinity"

    def test_zero(self) -> None:
        """Zero is handled correctly."""
        assert format_compact(0) == "0"


class TestFormatCurrency:
    """Tests for format_currency function."""

    def test_basic_formatting(self) -> None:
        """Basic currency formatting."""
        assert format_currency(1234.56) == "$1,234.56"

    def test_custom_symbol(self) -> None:
        """Custom currency symbol."""
        assert format_currency(1234.56, symbol="EUR") == "EUR1,234.56"
        assert format_currency(1234.56, symbol="GBP") == "GBP1,234.56"

    def test_custom_decimals(self) -> None:
        """Custom decimal places."""
        assert format_currency(1234.567, decimals=3) == "$1,234.567"
        assert format_currency(1234.567, decimals=0) == "$1,235"

    def test_negative(self) -> None:
        """Negative currency values."""
        assert format_currency(-1234.56) == "-$1,234.56"

    def test_large_numbers(self) -> None:
        """Large numbers with thousands separators."""
        assert format_currency(1234567890.12) == "$1,234,567,890.12"

    def test_small_numbers(self) -> None:
        """Small numbers."""
        assert format_currency(0.99) == "$0.99"
        assert format_currency(0.01) == "$0.01"

    def test_zero(self) -> None:
        """Zero value."""
        assert format_currency(0) == "$0.00"

    def test_nan(self) -> None:
        """NaN returns N/A."""
        assert format_currency(float("nan")) == "N/A"


class TestFormatPercent:
    """Tests for format_percent function."""

    def test_basic_formatting(self) -> None:
        """Basic percentage formatting."""
        assert format_percent(0.1234) == "12.34%"

    def test_whole_number_ratio(self) -> None:
        """Ratio of 1 equals 100%."""
        assert format_percent(1.0) == "100.00%"

    def test_greater_than_one(self) -> None:
        """Ratios greater than 1 produce percentages > 100%."""
        assert format_percent(1.5) == "150.00%"

    def test_custom_decimals(self) -> None:
        """Custom decimal places."""
        assert format_percent(0.12345, decimals=3) == "12.345%"
        assert format_percent(0.12345, decimals=0) == "12%"

    def test_negative(self) -> None:
        """Negative percentages."""
        assert format_percent(-0.1234) == "-12.34%"

    def test_zero(self) -> None:
        """Zero percentage."""
        assert format_percent(0) == "0.00%"

    def test_small_values(self) -> None:
        """Very small percentages."""
        assert format_percent(0.0001) == "0.01%"

    def test_nan(self) -> None:
        """NaN returns N/A."""
        assert format_percent(float("nan")) == "N/A"


class TestParseNumber:
    """Tests for parse_number function."""

    def test_empty_string(self) -> None:
        """Empty string returns None."""
        assert parse_number("") is None
        assert parse_number("   ") is None

    def test_plain_integer(self) -> None:
        """Parse plain integers."""
        assert parse_number("1234") == 1234.0

    def test_plain_float(self) -> None:
        """Parse plain floats."""
        assert parse_number("1234.56") == 1234.56

    def test_with_thousands_separators(self) -> None:
        """Parse numbers with thousands separators."""
        assert parse_number("1,234") == 1234.0
        assert parse_number("1,234,567.89") == 1234567.89

    def test_currency(self) -> None:
        """Parse currency formatted strings."""
        assert parse_number("$1,234.56") == 1234.56
        assert parse_number("EUR1,234.56") == 1234.56
        assert parse_number("-$1,234.56") == -1234.56

    def test_percentage(self) -> None:
        """Parse percentage strings back to ratio."""
        assert parse_number("12.34%") == pytest.approx(0.1234)
        assert parse_number("-12.34%") == pytest.approx(-0.1234)
        assert parse_number("100%") == 1.0

    def test_compact_notation_k(self) -> None:
        """Parse compact K notation."""
        assert parse_number("1.5K") == 1500.0
        assert parse_number("1.5k") == 1500.0

    def test_compact_notation_m(self) -> None:
        """Parse compact M notation."""
        assert parse_number("1.5M") == 1_500_000.0

    def test_compact_notation_b(self) -> None:
        """Parse compact B notation."""
        assert parse_number("1.5B") == 1_500_000_000.0

    def test_compact_notation_t(self) -> None:
        """Parse compact T notation."""
        assert parse_number("1.5T") == 1_500_000_000_000.0

    def test_negative_compact(self) -> None:
        """Parse negative compact notation."""
        assert parse_number("-1.5M") == -1_500_000.0

    def test_special_values(self) -> None:
        """Parse special values."""
        assert math.isnan(parse_number("N/A") or float("inf"))
        assert math.isnan(parse_number("NaN") or float("inf"))
        assert parse_number("Infinity") == float("inf")
        assert parse_number("-Infinity") == float("-inf")

    def test_invalid_string(self) -> None:
        """Invalid strings return None."""
        assert parse_number("not a number") is None
        assert parse_number("$$$") is None


class TestRoundTrip:
    """Tests for format-then-parse round trips."""

    def test_currency_roundtrip(self) -> None:
        """Currency can be formatted and parsed back."""
        original = 1234.56
        formatted = format_currency(original)
        parsed = parse_number(formatted)
        assert parsed == original

    def test_percent_roundtrip(self) -> None:
        """Percentage can be formatted and parsed back."""
        original = 0.1234
        formatted = format_percent(original)
        parsed = parse_number(formatted)
        assert parsed == pytest.approx(original)

    def test_compact_roundtrip(self) -> None:
        """Compact notation can be formatted and parsed back (approximately)."""
        original = 1_500_000.0
        formatted = format_compact(original, decimals=1)
        parsed = parse_number(formatted)
        assert parsed == original

    def test_negative_roundtrip(self) -> None:
        """Negative numbers can be formatted and parsed back."""
        original = -1234.56
        formatted = format_currency(original)
        parsed = parse_number(formatted)
        assert parsed == original
