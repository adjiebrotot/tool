"""Independent finance primitives for authoring expected values.

Written from textbook definitions, deliberately NOT from any tool in this repo.
Nothing here imports, reads, or replays the site's script.js. If a tool disagrees
with a function here, that disagreement is the finding.

Conventions are explicit in every function name or argument, because the whole
point of several of the test cases is that the repo is not consistent about them.
"""
from __future__ import annotations
import math
from typing import Iterable, Sequence


# ── Compounding ───────────────────────────────────────────────────────────────

def rate_nominal(annual_pct: float, per_year: int) -> float:
    """APR / m. What a bank quotes on a mortgage."""
    return annual_pct / 100.0 / per_year


def rate_effective(annual_pct: float, per_year: int) -> float:
    """(1+r)^(1/m) - 1. Equivalent-yield convention."""
    return (1.0 + annual_pct / 100.0) ** (1.0 / per_year) - 1.0


def grow(amount: float, annual_pct: float, years: float) -> float:
    return amount * (1.0 + annual_pct / 100.0) ** years


# ── Annuities ─────────────────────────────────────────────────────────────────

def annuity_payment(principal: float, period_rate: float, n: int) -> float:
    """Level payment that amortises `principal` to zero over n periods."""
    if n <= 0:
        return 0.0
    if period_rate == 0:
        return principal / n
    return principal * period_rate / (1.0 - (1.0 + period_rate) ** (-n))


def annuity_principal(payment: float, period_rate: float, n: int) -> float:
    """Present value of an n-period level annuity: the loan a payment supports."""
    if n <= 0:
        return 0.0
    if period_rate == 0:
        return payment * n
    return payment * (1.0 - (1.0 + period_rate) ** (-n)) / period_rate


def annuity_balance(principal: float, period_rate: float, n: int, k: int) -> float:
    """Closed-form outstanding balance after k payments of an n-period annuity."""
    if k >= n:
        return 0.0
    if period_rate == 0:
        return principal * (1 - k / n)
    pmt = annuity_payment(principal, period_rate, n)
    return principal * (1 + period_rate) ** k - pmt * (((1 + period_rate) ** k - 1) / period_rate)


def annuity_principal_bisect(payment: float, period_rate: float, n: int) -> float:
    """Same as annuity_principal but found by bisection on the payment function,
    so an expected value can be built without reusing the closed form."""
    lo, hi = 0.0, 1e12
    for _ in range(300):
        mid = (lo + hi) / 2
        if annuity_payment(mid, period_rate, n) < payment:
            lo = mid
        else:
            hi = mid
    return (lo + hi) / 2


# ── Progressive tax ───────────────────────────────────────────────────────────

def progressive_tax(taxable: float, bands: Sequence[tuple[float, float]]) -> float:
    """bands = [(upper_bound_or_None, rate_fraction), ...] ascending.

    Built as "tax the slice inside each band", the textbook statement.
    """
    if taxable <= 0:
        return 0.0
    tax, prev = 0.0, 0.0
    for upper, rate in bands:
        top = math.inf if upper is None else float(upper)
        slice_ = max(0.0, min(taxable, top) - prev)
        tax += slice_ * rate
        prev = top
        if taxable <= top:
            break
    return tax


def progressive_tax_base_plus(taxable: float, rows: Sequence[tuple[float, float, float]]) -> float:
    """ATO "base amount plus cents in the dollar over the threshold" form.

    rows = [(threshold, base_amount, marginal_rate), ...] ascending. A second,
    structurally different way to state the same schedule, used so a tax
    expectation is never built the same way the page walks it.
    """
    if taxable <= 0:
        return 0.0
    applicable = rows[0]
    for r in rows:
        if taxable > r[0]:
            applicable = r
    threshold, base, rate = applicable
    return base + max(0.0, taxable - threshold) * rate


# ── Series statistics ─────────────────────────────────────────────────────────

def daily_returns(prices: Sequence[float]) -> list[float]:
    return [prices[i] / prices[i - 1] - 1.0 for i in range(1, len(prices)) if prices[i - 1] > 0]


def sample_stdev(xs: Sequence[float]) -> float:
    n = len(xs)
    if n < 2:
        return 0.0
    m = sum(xs) / n
    return math.sqrt(sum((x - m) ** 2 for x in xs) / (n - 1))


def cagr(start: float, end: float, years: float) -> float:
    if start <= 0 or years <= 0:
        return float("nan")
    return (end / start) ** (1.0 / years) - 1.0


def xirr(flows: Iterable[tuple[float, float]], lo=-0.9999, hi=10.0) -> float | None:
    """flows = [(years_from_t0, amount), ...]. Bisection on NPV."""
    flows = list(flows)
    if not any(a < 0 for _, a in flows) or not any(a > 0 for _, a in flows):
        return None

    def npv(r):
        return sum(a / (1 + r) ** t for t, a in flows)

    flo, fhi = npv(lo), npv(hi)
    if flo * fhi > 0:
        return None
    for _ in range(300):
        mid = (lo + hi) / 2
        fm = npv(mid)
        if flo * fm < 0:
            hi = mid
        else:
            lo, flo = mid, fm
    return (lo + hi) / 2


# ── Technical indicators (textbook definitions) ───────────────────────────────

def sma(prices: Sequence[float], n: int) -> list[float | None]:
    out: list[float | None] = [None] * len(prices)
    for i in range(n - 1, len(prices)):
        out[i] = sum(prices[i - n + 1: i + 1]) / n
    return out


def ema(prices: Sequence[float], n: int) -> list[float | None]:
    out: list[float | None] = [None] * len(prices)
    if len(prices) < n:
        return out
    k = 2.0 / (n + 1)
    prev = sum(prices[:n]) / n
    out[n - 1] = prev
    for i in range(n, len(prices)):
        prev = prices[i] * k + prev * (1 - k)
        out[i] = prev
    return out


def rsi_wilder(prices: Sequence[float], n: int) -> list[float | None]:
    out: list[float | None] = [None] * len(prices)
    if len(prices) < n + 1:
        return out
    gains = losses = 0.0
    for i in range(1, n + 1):
        ch = prices[i] - prices[i - 1]
        gains += max(ch, 0.0)
        losses += max(-ch, 0.0)
    ag, al = gains / n, losses / n
    out[n] = 100.0 if al == 0 else 100 - 100 / (1 + ag / al)
    for i in range(n + 1, len(prices)):
        ch = prices[i] - prices[i - 1]
        ag = (ag * (n - 1) + max(ch, 0.0)) / n
        al = (al * (n - 1) + max(-ch, 0.0)) / n
        out[i] = 100.0 if al == 0 else 100 - 100 / (1 + ag / al)
    return out


def cross_up(fast: Sequence[float | None], slow: Sequence[float | None]) -> list[int]:
    """Indices where fast crosses above slow (state change, not level)."""
    hits = []
    for i in range(1, len(fast)):
        a0, a1, b0, b1 = fast[i - 1], fast[i], slow[i - 1], slow[i]
        if None in (a0, a1, b0, b1):
            continue
        if a0 <= b0 and a1 > b1:
            hits.append(i)
    return hits


if __name__ == "__main__":
    # Smoke: a 30y $800k loan at 6% nominal monthly.
    p = annuity_payment(800_000, rate_nominal(6, 12), 360)
    assert abs(p - 4796.40) < 0.02, p
    # And the inverse agrees, found a different way.
    assert abs(annuity_principal_bisect(p, rate_nominal(6, 12), 360) - 800_000) < 1
    print("ref.py self-check ok; 800k/6%/30y payment =", round(p, 2))
