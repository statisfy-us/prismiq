"""
Calculated field expression parser and SQL generator.

Parses RevealBI expression syntax (e.g., "if([is_won]==1, [amount], 0)")
and converts to PostgreSQL SQL expressions.

Supported functions:
- if(condition, true_val, false_val)
- sum(expr), count(expr), avg(expr), min(expr), max(expr)
- find(substring, text)
- date(year, month, day, hour, min, sec)
- year(date), month(date), day(date)
- today()
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

    def __init__(self, name: str):
        self.name = name

    def to_sql(self, field_mapping: dict[str, str], use_window_functions: bool = False) -> str:
        # Check if it's a calculated field that needs substitution
        if self.name in field_mapping:
            return f"({field_mapping[self.name]})"
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
            # MAKE_TIMESTAMP expects: year, month, day, hour, minute, second
            return f"MAKE_TIMESTAMP({', '.join(args_sql)})"

        elif self.name == "concatenate":
            # Concatenate all arguments with ||
            args_sql = [arg.to_sql(field_mapping, use_window_functions) for arg in self.args]
            return " || ".join(args_sql)

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
    """Binary operation: left op right"""

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
        elif sql_op in ["=", "<>"] and isinstance(self.left, Literal):
            if self.left.value in (0, 1) and isinstance(self.right, FieldRef):
                # Cast the field to integer for comparison
                right_sql = f"({right_sql})::int"

        return f"({left_sql} {sql_op} {right_sql})"


class Literal(ExprNode):
    """Literal value: number, string"""

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
        # - Operators: ==, !=, >=, <=, >, <, +, -, *, /
        # - Delimiters: ( ) , .
        pattern = r'\[([^\]]+)\]|(\d+\.?\d*)|("(?:[^"\\]|\\.)*")|([a-zA-Z_]\w*)|(\(|\)|,|\.)|(<= |>=|==|!=|>|<|[\+\-*/])'

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
        """Parse comparison operators: ==, !=, >, <, >=, <="""
        left, pos = self._parse_additive(tokens, pos)

        while pos < len(tokens) and tokens[pos] in ["==", "!=", ">", "<", ">=", "<="]:
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
        """Parse primary expressions: literals, field refs, function calls, parentheses."""
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
                value = float(num_str)
            else:
                value = int(num_str)
            return Literal(value), pos + 1

        # String literal
        elif token.startswith("STRING:"):
            value = token[7:]  # Remove "STRING:" prefix
            return Literal(value), pos + 1

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
        elif token == "(":
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
    agg_funcs = ["sum(", "avg(", "count(", "min(", "max("]
    expr_lower = expression.lower()
    return any(func in expr_lower for func in agg_funcs)


def resolve_calculated_fields(
    query_columns: list[dict[str, Any]],
    calculated_fields: list[dict[str, Any]],
) -> dict[str, tuple[str, bool]]:
    """
    Resolve calculated field dependencies and generate SQL expressions.

    Args:
        query_columns: Column selections from query (may reference calculated fields)
        calculated_fields: List of {name, expression} dicts

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

        # Resolve all dependencies first
        dep_sql_map = {}
        for dep in deps:
            if dep in calc_field_map:
                dep_sql, dep_has_agg = resolve(dep)
                # If this expression has aggregation and the dependency doesn't,
                # wrap the dependency in SUM so it works with GROUP BY
                if has_agg and not dep_has_agg:
                    dep_sql = f"SUM({dep_sql})"
                dep_sql_map[dep] = dep_sql
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
