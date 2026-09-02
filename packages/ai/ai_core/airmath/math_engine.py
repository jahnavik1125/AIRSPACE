import sympy as sp
from sympy.parsing.sympy_parser import parse_expr, standard_transformations, implicit_multiplication_application
from typing import Dict, Any, List, Tuple

_TRANSFORMATIONS = standard_transformations + (implicit_multiplication_application,)

class MathEngine:
  """
  Uses SymPy to perform symbolic algebra, linear/quadratic equations solving,
  calculus derivatives/integrals, and step-by-step solution derivations.
  """
  def __init__(self):
    pass

  def _parse_equation(self, expr_str: str) -> Tuple[sp.Expr, sp.Symbol]:
    """
    Parses a string equation (e.g. '2x + 5 = 15' or '2*x + 5 = 15') into a SymPy expression
    equated to 0, and returns the active symbol variable.
    """
    # Normalize exponents and superscripts
    normalized = expr_str.replace("^", "**").replace("²", "**2").replace("³", "**3")

    # 1. Resolve variable symbol
    x = sp.Symbol('x')
    y = sp.Symbol('y')
    
    # Choose active variable
    active_var = x
    if 'y' in normalized and 'x' not in normalized:
      active_var = y

    # 2. Split equality
    if "=" in normalized:
      lhs_str, rhs_str = normalized.split("=")
      lhs = parse_expr(lhs_str.strip(), transformations=_TRANSFORMATIONS)
      rhs = parse_expr(rhs_str.strip(), transformations=_TRANSFORMATIONS)
      expr = lhs - rhs
    else:
      expr = parse_expr(normalized.strip(), transformations=_TRANSFORMATIONS)

    return expr, active_var

  def solve(self, expr_str: str) -> Dict[str, Any]:
    """
    Solves linear, quadratic, factorization, or calculus operations.
    Returns: Dict containing results and step-by-step logs.
    """
    try:
      # Pre-format shorthand inputs like '^' -> '**'
      formatted_str = expr_str.replace("^", "**")
      
      # Check if calculus command is requested (e.g. derivative of ...)
      is_derivative = "diff" in formatted_str or "derivative" in formatted_str
      is_integral = "int" in formatted_str or "integral" in formatted_str
      
      # Clean up command words
      clean_str = formatted_str.replace("diff", "").replace("derivative", "").replace("integral", "").replace("int", "").strip()

      expr, var = self._parse_equation(clean_str)

      # 1. Derivatives calculation
      if is_derivative:
        deriv = sp.diff(expr, var)
        return {
          "status": "success",
          "operation": "derivative",
          "result": str(deriv),
          "latex_result": sp.latex(deriv),
          "steps": [
            f"Given expression: {sp.latex(expr)}",
            f"Differentiate with respect to {var}:",
            f"Result = {sp.latex(deriv)}"
          ]
        }

      # 2. Integrals calculation
      if is_integral:
        integral = sp.integrate(expr, var)
        return {
          "status": "success",
          "operation": "integral",
          "result": f"{integral} + C",
          "latex_result": f"{sp.latex(integral)} + C",
          "steps": [
            f"Given expression: {sp.latex(expr)}",
            f"Integrate with respect to {var}:",
            f"Result = {sp.latex(integral)} + C"
          ]
        }

      # 3. Handle Factorization/Simplification if no equality
      if "=" not in clean_str:
        factored = sp.factor(expr)
        simplified = sp.simplify(expr)
        return {
          "status": "success",
          "operation": "simplification",
          "result": str(simplified),
          "latex_result": sp.latex(simplified),
          "factored": str(factored),
          "latex_factored": sp.latex(factored),
          "steps": [
            f"Given expression: {sp.latex(expr)}",
            f"Factored form: {sp.latex(factored)}",
            f"Simplified form: {sp.latex(simplified)}"
          ]
        }

      # 4. Handle Equations Solvers
      # Check if Linear (degree 1)
      degree = sp.degree(expr, var)

      if degree == 1:
        # ax + b = 0
        a = sp.diff(expr, var) # coefficient
        b = expr.subs(var, 0)  # constant
        solutions = sp.solve(expr, var)
        
        steps = [
          f"LHS = RHS: {clean_str}",
          f"Rewrite in standard form (ax + b = 0): {sp.latex(expr)} = 0",
          f"Isolate constant term: {sp.latex(a * var)} = {sp.latex(-b)}",
          f"Divide by coefficient of {var}: {var} = {sp.latex(solutions[0])}"
        ]
        return {
          "status": "success",
          "operation": "linear_solve",
          "result": [str(s) for s in solutions],
          "latex_result": ", ".join(sp.latex(s) for s in solutions),
          "steps": steps
        }

      elif degree == 2:
        # ax^2 + bx + c = 0
        a = expr.coeff(var, 2)
        b = expr.coeff(var, 1)
        c = expr.coeff(var, 0)
        solutions = sp.solve(expr, var)
        
        discriminant = b**2 - 4*a*c
        
        steps = [
          f"Given equation: {clean_str}",
          f"Rewrite in standard quadratic form (ax^2 + bx + c = 0): {sp.latex(expr)} = 0",
          f"Identify coefficients: a = {a}, b = {b}, c = {c}",
          f"Calculate Discriminant (b^2 - 4ac): \\Delta = {b}^2 - 4({a})({c}) = {discriminant}",
          f"Apply Quadratic Formula: {var} = \\frac{{-b \\pm \\sqrt{{\\Delta}}}}{{2a}}",
          f"Solutions: {', '.join(sp.latex(s) for s in solutions)}"
        ]
        return {
          "status": "success",
          "operation": "quadratic_solve",
          "result": [str(s) for s in solutions],
          "latex_result": ", ".join(sp.latex(s) for s in solutions),
          "steps": steps
        }

      else:
        # High order equation solving fallback
        solutions = sp.solve(expr, var)
        if not solutions:
          return {"status": "unsupported", "detail": "Expression could not be solved symbolically."}
        
        return {
          "status": "success",
          "operation": "general_solve",
          "result": [str(s) for s in solutions],
          "latex_result": ", ".join(sp.latex(s) for s in solutions),
          "steps": [
            f"Given equation: {clean_str}",
            f"Solve for {var} symbolically:",
            f"Solutions: {', '.join(sp.latex(s) for s in solutions)}"
          ]
        }

    except Exception as e:
      return {
        "status": "unsupported",
        "detail": f"Failed to solve expression: {str(e)}"
      }
