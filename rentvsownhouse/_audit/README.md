# Rent vs Own — accounting-integrity harness

Drives the real page in headless Chromium (CDN libs stubbed), captures the
app's own Own/Rent/RTB cashflow CSV exports and checks accounting identities:
yearly cash conservation, Σ principal == loan, closed-form annuity balances,
auto-budget definition, and RTB transition equity/loan amounts.

Run: `node run.mjs`
(See also ../audit/ — the earlier JS↔Python cross-model audit.)
