"""Calculated field expression parser and SQL generator.

Parses RevealBI expression syntax (e.g., "if([is_won]==1, [amount], 0)")
and converts to PostgreSQL SQL expressions.

Supported functions:
- if(condition, true_val, false_val)
- sum(expr), count(expr), avg(expr), min(expr), max(expr)
- find(substring, text)
- date(year, month, day, hour, min, sec)
- year(date), month(date), day(date)
- datediff(date1, date2, interval) - interval: 'd'/'day', 'm'/'month', 'y'/'year', 'h'/'hour', 'mi'/'minute', 's'/'second'
- today()
- concatenate(arg1, arg2, ...)
- Operators: +, -, *, /, ==, !=, >, <, >=, <=
- Field references: [field_name] or [Table.field]
"""

from __future__ import annotations

import re
from typing import Any

# ============================================================================
# Expression AST Nodes
# ============================================================================


class ExprNode:
    """Base class for expression AST nodes."""

    def to_sql(self, field_mapping: dict[str, str], use_window_functions: bool = False) -> str:
        """Convert to PostgreSQL SQL.

        Args:
            field_mapping: Map of calculated field names to their SQL expressions
            use_window_functions: If True, use window functions (OVER ()) for aggregations

        Returns:
            PostgreSQL SQL expression
        """
        raise NotImplementedError


class FieldRef(ExprNode):
    """Field reference: [field_name] or [Table.field]"""

    # Patterns for RevealBI aggregation references like [Sum of X], [Count Distinct of Y]
    AGG_PATTERNS = {  # noqa: RUF012
        "Sum of ": "SUM",
        "Average of ": "AVG",
        "Count of ": "COUNT",
        "Count Distinct of ": "COUNT_DISTINCT",
        "Min of ": "MIN",
        "Max of ": "MAX",
    }

    def __init__(self, name: str):
        self.name = name

    def to_sql(self, field_mapping: dict[str, str], use_window_functions: bool = False) -> str:
        # Check if it's a calculated field that needs substitution
        if self.name in field_mapping:
            return f"({field_mapping[self.name]})"

        # Handle RevealBI aggregation references like [Sum of pageview_cms]
        # These are post-aggregation references used in calculated fields
        for prefix, agg_func in self.AGG_PATTERNS.items():
            if self.name.startswith(prefix):
                inner_field = self.name[len(prefix) :]
                # Check if the inner field is also a calculated field
                if inner_field in field_mapping:
                    inner_sql = f"({field_mapping[inner_field]})"
                else:
                    inner_sql = f'"{inner_field}"'
                # Generate the aggregation SQL
                if agg_func == "COUNT_DISTINCT":
                    return f"COUNT(DISTINCT {inner_sql})"
                else:
                    return f"{agg_func}({inner_sql})"

        # Handle alias.column syntax (e.g., "A.date" from RevealBI joined tables)
        # This generates "A"."date" instead of "A.date"
        if "." in self.name:
            parts = self.name.split(".", 1)
            if len(parts) == 2:
                alias, column = parts
                return f'"{alias}"."{column}"'

        # Regular column reference
        return f'"{self.name}"'


class FunctionCall(ExprNode):
    """Function call: func(arg1, arg2, ...)"""

    def __init__(self, name: str, args: list[ExprNode]):
        self.name = name
        self.args = args

    def to_sql(self, field_mapping: dict[str, str], use_window_functions: bool = False) -> str:
        if self.name == "if":
            # if(condition, true_val, false_val) -> CASE WHEN condition THEN true_val ELSE false_val END
            cond = self.args[0].to_sql(field_mapping, use_window_functions)
            true_val = self.args[1].to_sql(field_mapping, use_window_functions)
            false_val = self.args[2].to_sql(field_mapping, use_window_functions)
            return f"CASE WHEN {cond} THEN {true_val} ELSE {false_val} END"

        elif self.name == "sum":
            arg = self.args[0].to_sql(field_mapping, use_window_functions)
            if use_window_functions:
                # Use a scalar subquery placeholder instead of OVER ()
                # main.py will replace __SCALAR_SUM_<column>__ with actual subquery
                if isinstance(self.args[0], FieldRef):
                    column_name = self.args[0].name
                    return f"__SCALAR_SUM_{column_name}__"
                return f"SUM({arg}) OVER ()"
            return f"SUM({arg})"

        elif self.name == "avg":
            arg = self.args[0].to_sql(field_mapping, use_window_functions)
            if use_window_functions:
                return f"AVG({arg}) OVER ()"
            return f"AVG({arg})"

        elif self.name == "count":
            arg = self.args[0].to_sql(field_mapping, use_window_functions)
            if use_window_functions:
                return f"COUNT({arg}) OVER ()"
            return f"COUNT({arg})"

        elif self.name == "min":
            arg = self.args[0].to_sql(field_mapping, use_window_functions)
            if use_window_functions:
                return f"MIN({arg}) OVER ()"
            return f"MIN({arg})"

        elif self.name == "max":
            arg = self.args[0].to_sql(field_mapping, use_window_functions)
            if use_window_functions:
                return f"MAX({arg}) OVER ()"
            return f"MAX({arg})"

        elif self.name == "find":
            # find(substring, text) -> POSITION(substring IN text)
            substring = self.args[0].to_sql(field_mapping, use_window_functions)
            text = self.args[1].to_sql(field_mapping, use_window_functions)
            return f"POSITION({substring} IN {text})"

        elif self.name == "today":
            return "CURRENT_DATE"

        elif self.name == "year":
            arg = self.args[0].to_sql(field_mapping, use_window_functions)
            return f"EXTRACT(YEAR FROM {arg})"

        elif self.name == "month":
            arg = self.args[0].to_sql(field_mapping, use_window_functions)
            return f"EXTRACT(MONTH FROM {arg})"

        elif self.name == "day":
            arg = self.args[0].to_sql(field_mapping, use_window_functions)
            return f"EXTRACT(DAY FROM {arg})"

        elif self.name == "date":
            # date(year, month, day, hour, min, sec) -> MAKE_TIMESTAMP
            args_sql = [arg.to_sql(field_mapping, use_window_functions) for arg in self.args]
            # MAKE_TIMESTAMP expects: year, month, day, hour, minute, second (all as INTEGER)
            # Cast each arg to INTEGER since EXTRACT() returns NUMERIC
            args_cast = [f"({a})::INTEGER" for a in args_sql]
            return f"MAKE_TIMESTAMP({', '.join(args_cast)})"

        elif self.name == "concatenate":
            # Concatenate all arguments with ||
            args_sql = [arg.to_sql(field_mapping, use_window_functions) for arg in self.args]
            return " || ".join(args_sql)

        elif self.name == "datediff":
            # DATEDIFF(start_date, end_date, interval) -> PostgreSQL date arithmetic
            # RevealBI syntax: datediff(start, end, interval) returns (end - start)
            # Example: datediff(today(), [date], 'd') = [date] - today()
            #   If date is Jan 17 and today is Jan 18, result = -1 (yesterday is -1 day from today)
            # PostgreSQL equivalent: (date2 - date1) to match RevealBI semantics
            if len(self.args) >= 2:
                date1 = self.args[0].to_sql(field_mapping, use_window_functions)
                date2 = self.args[1].to_sql(field_mapping, use_window_functions)
                # Get interval type if specified (3rd arg)
                interval = "d"  # default to days
                if len(self.args) >= 3 and isinstance(self.args[2], Literal):
                    interval = str(self.args[2].value).lower()

                # Note: RevealBI datediff returns (end - start), so we use (date2 - date1)
                if interval in ("d", "day", "days"):
                    # Day difference: cast to date and subtract (end - start)
                    return f"(({date2})::date - ({date1})::date)"
                elif interval in ("m", "month", "months"):
                    # Month difference: use age function (end - start)
                    return f"(EXTRACT(YEAR FROM AGE({date2}::date, {date1}::date)) * 12 + EXTRACT(MONTH FROM AGE({date2}::date, {date1}::date)))::int"
                elif interval in ("y", "year", "years"):
                    # Year difference: use age function (end - start)
                    return f"EXTRACT(YEAR FROM AGE({date2}::date, {date1}::date))::int"
                elif interval in ("h", "hour", "hours"):
                    # Hour difference (end - start)
                    return f"EXTRACT(EPOCH FROM ({date2}::timestamp - {date1}::timestamp)) / 3600"
                elif interval in ("mi", "minute", "minutes"):
                    # Minute difference (end - start)
                    return f"EXTRACT(EPOCH FROM ({date2}::timestamp - {date1}::timestamp)) / 60"
                elif interval in ("s", "second", "seconds"):
                    # Second difference (end - start)
                    return f"EXTRACT(EPOCH FROM ({date2}::timestamp - {date1}::timestamp))"
                else:
                    # Default to days (end - start)
                    return f"(({date2})::date - ({date1})::date)"
            else:
                # Not enough arguments, return raw
                args_sql = [arg.to_sql(field_mapping, use_window_functions) for arg in self.args]
                return f"DATEDIFF({', '.join(args_sql)})"

        else:
            # Unknown function - pass through
            args_sql = [arg.to_sql(field_mapping, use_window_functions) for arg in self.args]
            return f"{self.name.upper()}({', '.join(args_sql)})"


class MethodCall(ExprNode):
    """Method call on an object: obj.method(args)"""

    def __init__(self, obj: ExprNode, method: str, args: list[ExprNode]):
        self.obj = obj
        self.method = method
        self.args = args

    def to_sql(self, field_mapping: dict[str, str], use_window_functions: bool = False) -> str:
        obj_sql = self.obj.to_sql(field_mapping, use_window_functions)

        if self.method == "concatenate":
            # [field].concatenate() -> COALESCE([field], '')
            # When concatenating multiple values, PostgreSQL || handles it
            return f"COALESCE({obj_sql}, '')"

        else:
            # Unknown method
            return f"{obj_sql}.{self.method}()"


class BinaryOp(ExprNode):
    """Binary operation: left op right."""

    def __init__(self, op: str, left: ExprNode, right: ExprNode):
        self.op = op
        self.left = left
        self.right = right

    def to_sql(self, field_mapping: dict[str, str], use_window_functions: bool = False) -> str:
        left_sql = self.left.to_sql(field_mapping, use_window_functions)
        right_sql = self.right.to_sql(field_mapping, use_window_functions)

        # Map RevealBI operators to SQL
        op_map = {"==": "=", "!=": "<>"}
        sql_op = op_map.get(self.op, self.op)

        # Handle boolean comparison with integer (e.g., [is_won] == 1)
        # Cast boolean fields to integer when comparing with 0 or 1
        if sql_op in ["=", "<>"] and isinstance(self.right, Literal):
            if self.right.value in (0, 1) and isinstance(self.left, FieldRef):
                # Cast the field to integer for comparison
                left_sql = f"({left_sql})::int"
        elif sql_op in ["=", "<>"] and isinstance(self.left, Literal):  # noqa: SIM102
            if self.left.value in (0, 1) and isinstance(self.right, FieldRef):
                # Cast the field to integer for comparison
                right_sql = f"({right_sql})::int"

        return f"({left_sql} {sql_op} {right_sql})"


class Literal(ExprNode):
    """Literal value: number, string."""

    def __init__(self, value: Any):
        self.value = value

    def to_sql(self, field_mapping: dict[str, str], use_window_functions: bool = False) -> str:
        if isinstance(self.value, str):
            # Escape single quotes by doubling them
            escaped = self.value.replace("'", "''")
            return f"'{escaped}'"
        elif self.value is None:
            return "NULL"
        return str(self.value)


# ============================================================================
# Expression Parser
# ============================================================================


class ExpressionParser:
    """Parser for RevealBI expression syntax.

    Implements a recursive descent parser for the expression language.
    """

    def parse(self, expression: str) -> ExprNode:
        """Parse expression string into AST.

        Args:
            expression: RevealBI expression string

        Returns:
            Root AST node

        Raises:
            ValueError: If expression syntax is invalid
        """
        # Tokenize
        tokens = self._tokenize(expression)

        if not tokens:
            raise ValueError("Empty expression")

        # Parse tokens into AST
        ast, pos = self._parse_expr(tokens, 0)

        # Check that we consumed all tokens
        if pos < len(tokens):
            raise ValueError(f"Unexpected tokens after expression: {tokens[pos:]}")

        return ast

    def _tokenize(self, expr: str) -> list[str]:
        """Tokenize expression into list of tokens.

        Args:
            expr: Expression string

        Returns:
            List of tokens
        """
        # Regex to match:
        # - Field refs [name]
        # - Numbers (including decimals)
        # - Strings in quotes
        # - Identifiers (function names)
        # - Operators: ==, !=, >=, <=, >, <, +, -, *, /, = (single = for RevealBI compat)
        # - Delimiters: ( ) , .
        # Note: Order matters - must match == before = to avoid partial match
        pattern = r'\[([^\]]+)\]|(\d+\.?\d*)|("(?:[^"\\]|\\.)*")|([a-zA-Z_]\w*)|(\(|\)|,|\.)|(<=|>=|==|!=|>|<|=|[\+\-*/])'

        tokens = []
        pos = 0

        for match in re.finditer(pattern, expr):
            # Skip whitespace between tokens
            if match.start() > pos:
                ws = expr[pos : match.start()]
                if not ws.isspace():
                    raise ValueError(f"Invalid character at position {pos}: {ws}")

            if match.group(1):  # Field reference
                tokens.append(f"FIELD:{match.group(1)}")
            elif match.group(2):  # Number
                tokens.append(f"NUMBER:{match.group(2)}")
            elif match.group(3):  # String
                # Remove quotes and unescape
                s = match.group(3)[1:-1].replace('\\"', '"')
                tokens.append(f"STRING:{s}")
            elif match.group(4):  # Identifier
                tokens.append(f"ID:{match.group(4)}")
            elif match.group(5):  # Delimiter
                tokens.append(match.group(5))
            elif match.group(6):  # Operator
                tokens.append(match.group(6))

            pos = match.end()

        # Check for trailing non-whitespace
        if pos < len(expr) and not expr[pos:].isspace():
            raise ValueError(f"Invalid character at position {pos}: {expr[pos:]}")

        return tokens

    def _parse_expr(self, tokens: list[str], pos: int) -> tuple[ExprNode, int]:
        """Parse a complete expression (handles all operators).

        Uses precedence climbing for operator precedence.

        Args:
            tokens: Token list
            pos: Current position in token list

        Returns:
            (AST node, next position)
        """
        # Parse comparison expressions (lowest precedence)
        return self._parse_comparison(tokens, pos)

    def _parse_comparison(self, tokens: list[str], pos: int) -> tuple[ExprNode, int]:
        """Parse comparison operators: ==, =, !=, >, <, >=, <="""
        left, pos = self._parse_additive(tokens, pos)

        # Note: "=" is RevealBI's equality operator, equivalent to "=="
        while pos < len(tokens) and tokens[pos] in [
            "==",
            "=",
            "!=",
            ">",
            "<",
            ">=",
            "<=",
        ]:
            op = tokens[pos]
            pos += 1
            right, pos = self._parse_additive(tokens, pos)
            left = BinaryOp(op, left, right)

        return left, pos

    def _parse_additive(self, tokens: list[str], pos: int) -> tuple[ExprNode, int]:
        """Parse additive operators: +, -"""
        left, pos = self._parse_multiplicative(tokens, pos)

        while pos < len(tokens) and tokens[pos] in ["+", "-"]:
            op = tokens[pos]
            pos += 1
            right, pos = self._parse_multiplicative(tokens, pos)
            left = BinaryOp(op, left, right)

        return left, pos

    def _parse_multiplicative(self, tokens: list[str], pos: int) -> tuple[ExprNode, int]:
        """Parse multiplicative operators: *, /"""
        left, pos = self._parse_primary(tokens, pos)

        while pos < len(tokens) and tokens[pos] in ["*", "/"]:
            op = tokens[pos]
            pos += 1
            right, pos = self._parse_primary(tokens, pos)
            left = BinaryOp(op, left, right)

        return left, pos

    def _parse_primary(self, tokens: list[str], pos: int) -> tuple[ExprNode, int]:
        """Parse primary expressions: literals, field refs, function calls,
        parentheses."""
        if pos >= len(tokens):
            raise ValueError("Unexpected end of expression")

        token = tokens[pos]

        # Field reference
        if token.startswith("FIELD:"):
            field_name = token[6:]  # Remove "FIELD:" prefix
            pos += 1

            # Check for method call: [field].method()
            if pos < len(tokens) and tokens[pos] == ".":
                pos += 1
                if pos >= len(tokens) or not tokens[pos].startswith("ID:"):
                    raise ValueError("Expected method name after '.'")
                method_name = tokens[pos][3:]  # Remove "ID:" prefix
                pos += 1

                # Expect ()
                if pos >= len(tokens) or tokens[pos] != "(":
                    raise ValueError(f"Expected '(' after method name '{method_name}'")
                pos += 1
                if pos >= len(tokens) or tokens[pos] != ")":
                    raise ValueError(f"Expected ')' after '{method_name}('")
                pos += 1

                return MethodCall(FieldRef(field_name), method_name, []), pos

            return FieldRef(field_name), pos

        # Number literal
        elif token.startswith("NUMBER:"):
            num_str = token[7:]  # Remove "NUMBER:" prefix
            if "." in num_str:
                num_value: float | int = float(num_str)
            else:
                num_value = int(num_str)
            return Literal(num_value), pos + 1

        # String literal
        elif token.startswith("STRING:"):
            str_value = token[7:]  # Remove "STRING:" prefix
            return Literal(str_value), pos + 1

        # Function call or identifier
        elif token.startswith("ID:"):
            func_name = token[3:]  # Remove "ID:" prefix
            pos += 1

            # Check for function call: name(args)
            if pos < len(tokens) and tokens[pos] == "(":
                pos += 1  # Skip '('

                # Parse arguments
                args = []
                while pos < len(tokens) and tokens[pos] != ")":
                    arg, pos = self._parse_expr(tokens, pos)
                    args.append(arg)

                    if pos < len(tokens) and tokens[pos] == ",":
                        pos += 1  # Skip ','

                if pos >= len(tokens):
                    raise ValueError(f"Expected ')' after function arguments for '{func_name}'")

                pos += 1  # Skip ')'

                return FunctionCall(func_name, args), pos

            else:
                # Just an identifier (shouldn't happen in valid expressions)
                raise ValueError(f"Unexpected identifier: {func_name}")

        # Parenthesized expression
        elif token == "(":  # noqa: S105
            pos += 1
            expr, pos = self._parse_expr(tokens, pos)

            if pos >= len(tokens) or tokens[pos] != ")":
                raise ValueError("Expected ')' after expression")

            return expr, pos + 1

        else:
            raise ValueError(f"Unexpected token: {token}")


# ============================================================================
# Dependency Resolution
# ============================================================================


def has_aggregation(expression: str) -> bool:
    """Check if an expression contains aggregation functions.

    Args:
        expression: Expression string to check

    Returns:
        True if expression contains sum, avg, count, min, max, etc.
    """
    # Standard aggregation function syntax: sum(, avg(, count(, etc.
    agg_funcs = ["sum(", "avg(", "count(", "min(", "max("]
    expr_lower = expression.lower()
    if any(func in expr_lower for func in agg_funcs):
        return True

    # RevealBI aggregation reference syntax: [Sum of X], [Count Distinct of Y], etc.
    # These are field references that represent aggregated values
    revealbi_agg_patterns = [
        "[sum of ",
        "[average of ",
        "[count of ",
        "[count distinct of ",
        "[min of ",
        "[max of ",
    ]
    return any(pattern in expr_lower for pattern in revealbi_agg_patterns)


def resolve_calculated_fields(
    query_columns: list[dict[str, Any]],
    calculated_fields: list[dict[str, Any]],
    base_table_name: str | None = None,
) -> dict[str, tuple[str, bool]]:
    """Resolve calculated field dependencies and generate SQL expressions.

    Args:
        query_columns: Column selections from query (may reference calculated fields)
        calculated_fields: List of {name, expression} dicts
        base_table_name: Optional base table name to prefix unqualified column references.
                         When there are JOINs, this prevents "ambiguous column" errors.
                         Example: "account_custom_fields_view" -> "account_custom_fields_view"."column"

    Returns:
        Dict mapping field name to (sql_expression, has_aggregation) tuple
    """
    # Build map of calculated field definitions
    calc_field_map = {cf["name"]: cf["expression"] for cf in calculated_fields}

    if not calc_field_map:
        return {}

    # Build map of which calculated fields will have outer aggregations applied
    outer_agg_map = {}
    for col in query_columns:
        col_name = col.get("column")
        col_agg = col.get("aggregation", "none")
        if col_name in calc_field_map and col_agg and col_agg != "none":
            outer_agg_map[col_name] = col_agg

    # Parse all expressions
    parser = ExpressionParser()
    parsed = {}
    for name, expr in calc_field_map.items():
        try:
            parsed[name] = parser.parse(expr)
        except Exception as e:
            raise ValueError(f"Failed to parse calculated field '{name}': {e}") from e

    # Topological sort to resolve dependencies
    resolved: dict[str, tuple[str, bool]] = {}  # name -> (SQL expression, has_aggregation)
    visiting: set[str] = set()  # For cycle detection

    def resolve(name: str) -> tuple[str, bool]:
        """Resolve a calculated field and its dependencies."""
        if name in resolved:
            return resolved[name]

        if name not in parsed:
            # Not a calculated field, return as-is (will be handled as column reference)
            return (f'"{name}"', False)

        if name in visiting:
            raise ValueError(f"Circular dependency detected in calculated field: {name}")

        visiting.add(name)

        # Get AST for this field
        ast = parsed[name]

        # Extract field dependencies
        deps = _extract_field_refs(ast)

        # Check if original expression has aggregation
        original_expr = calc_field_map[name]
        has_agg = has_aggregation(original_expr)

        # Check if this field will have an outer aggregation applied
        will_have_outer_agg = name in outer_agg_map

        # Helper to check for and extract RevealBI aggregation reference patterns
        # e.g., "Sum of pageview_cms" -> ("SUM", "pageview_cms")
        def parse_agg_reference(field_name: str) -> tuple[str, str] | None:
            """Check if field_name is an aggregation reference like 'Sum of
            X'."""
            agg_patterns = {
                "Sum of ": "SUM",
                "Average of ": "AVG",
                "Count of ": "COUNT",
                "Count Distinct of ": "COUNT_DISTINCT",
                "Min of ": "MIN",
                "Max of ": "MAX",
            }
            for prefix, agg_func in agg_patterns.items():
                if field_name.startswith(prefix):
                    return (agg_func, field_name[len(prefix) :])
            return None

        # Resolve all dependencies first
        dep_sql_map = {}
        for dep in deps:
            # Check if this is an aggregation reference like "Sum of pageview_cms"
            agg_ref = parse_agg_reference(dep)
            if agg_ref:
                agg_func, inner_field = agg_ref
                # Resolve the inner field
                if inner_field in calc_field_map:
                    inner_sql, _ = resolve(inner_field)
                elif "." in inner_field:
                    parts = inner_field.split(".", 1)
                    inner_sql = f'"{parts[0]}"."{parts[1]}"'
                elif base_table_name:
                    inner_sql = f'"{base_table_name}"."{inner_field}"'
                else:
                    inner_sql = f'"{inner_field}"'
                # Build the aggregation SQL
                if agg_func == "COUNT_DISTINCT":
                    dep_sql_map[dep] = f"COUNT(DISTINCT {inner_sql})"
                else:
                    dep_sql_map[dep] = f"{agg_func}({inner_sql})"
            elif dep in calc_field_map:
                dep_sql, dep_has_agg = resolve(dep)
                # If this expression has aggregation and the dependency doesn't,
                # wrap the dependency in SUM so it works with GROUP BY
                if has_agg and not dep_has_agg:
                    dep_sql = f"SUM({dep_sql})"
                dep_sql_map[dep] = dep_sql
            else:
                # Not a calculated field - format as column reference
                # Handle alias.column syntax (e.g., "A.date" from RevealBI joined tables)
                if "." in dep:
                    parts = dep.split(".", 1)
                    if len(parts) == 2:
                        alias, column = parts
                        dep_sql_map[dep] = f'"{alias}"."{column}"'
                    else:
                        dep_sql_map[dep] = f'"{dep}"'
                elif base_table_name:
                    # Only qualify with base table name if this looks like a real database column.
                    # Database columns typically use snake_case without spaces.
                    # If the dependency name contains spaces or special chars, it's likely
                    # a reference to another calculated field that wasn't found in calc_field_map
                    # (possibly defined in another widget). Don't apply table prefix in that case.
                    looks_like_db_column = " " not in dep and not any(
                        c in dep for c in ["(", ")", "+", "-", "*", "/"]
                    )
                    if looks_like_db_column:
                        # Qualify with base table name to avoid ambiguity in JOINs
                        dep_sql_map[dep] = f'"{base_table_name}"."{dep}"'
                    else:
                        # Likely a calculated field reference - don't qualify
                        dep_sql_map[dep] = f'"{dep}"'
                else:
                    dep_sql_map[dep] = f'"{dep}"'

        # Convert to SQL with resolved dependencies
        # Use window functions if:
        # 1. This calculated field has aggregation in its expression
        # 2. AND an outer aggregation will be applied (from VisualizationDataSpec)
        use_window_functions = has_agg and will_have_outer_agg
        sql = ast.to_sql(dep_sql_map, use_window_functions=use_window_functions)

        resolved[name] = (sql, has_agg)

        visiting.remove(name)
        return (sql, has_agg)

    # Resolve all calculated fields (even if not directly used in query)
    # This ensures all dependencies are resolved
    for name in calc_field_map:
        resolve(name)

    return resolved


def _extract_field_refs(node: ExprNode) -> list[str]:
    """Extract all field references from AST.

    Args:
        node: AST node to extract from

    Returns:
        List of field names referenced
    """
    if isinstance(node, FieldRef):
        return [node.name]
    elif isinstance(node, FunctionCall):
        refs = []
        for arg in node.args:
            refs.extend(_extract_field_refs(arg))
        return refs
    elif isinstance(node, MethodCall):
        refs = _extract_field_refs(node.obj)
        for arg in node.args:
            refs.extend(_extract_field_refs(arg))
        return refs
    elif isinstance(node, BinaryOp):
        return _extract_field_refs(node.left) + _extract_field_refs(node.right)
    else:
        return []
