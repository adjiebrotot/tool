# Financial tools — regression test protocol

The rule this whole directory exists to enforce:

> **An expected result may never be derived from the engine's own output, nor from
> reading the engine's implementation.** It is derived from finance first
> principles, from the documented intent on the page, or from a property the
> result must hold regardless of implementation. It is written down and frozen
> *before* the engine is run.

## The three phases

| Phase | Who | Sees | Produces |
| --- | --- | --- | --- |
| 1. Specify | expectation author | `index.html` (the form + the page's own claims), finance first principles, `_qa/lib/ref.py` | `_qa/contract/<tool>.contract.json` (inputs + observable keys) and `_qa/plan/<tool>.expected.json` (the expected values) |
| 2. Execute | runner author | `_qa/contract/<tool>.contract.json` and the real page | `_qa/results/<tool>.actual.json` |
| 3. Evaluate | evaluator | both | `_qa/results/<tool>.verdict.json` |

Phase 1 must not read `script.js`. Phase 2 must not read `_qa/plan/`. The split is
what makes the agreement meaningful: if the two sides agree, the maths agrees,
rather than the engine being compared to a transcription of itself.

`_qa/plan/FREEZE.sha256` records the digest of every expectation file at the
moment it was authored. `node _qa/eval/check-freeze.mjs` re-verifies it. A
verdict produced against a mutated expectation file is not a verdict.

## Contract file shape

```jsonc
{
  "tool": "financingvscash",
  "page": "financingvscash/index.html",
  "cases": [{
    "id": "F1",
    "title": "Period rate convention",
    "setup": { /* exactly what the runner must enter, by DOM id */ },
    "observe": [
      { "key": "payment", "what": "The repayment per period shown in the comparison table" }
    ]
  }]
}
```

`setup` is whatever the runner needs to reproduce the state. `observe` names
the quantities to read back and says what each one means in plain words, so the
runner can find it without being told which expected value it feeds.

## Expectation file shape

```jsonc
{
  "tool": "financingvscash",
  "authored_utc": "2026-09-18T00:00:00Z",
  "cases": [{
    "id": "F1",
    "severity": "major",
    "basis": "Standard annuity formula, nominal APR/12 convention.",
    "expect": [
      { "key": "payment", "op": "~=", "value": 1933.28, "tol": 0.01,
        "why": "P=100000, i=0.06/12, n=60 -> P*i/(1-(1+i)^-n)" }
    ]
  }]
}
```

`op` is one of `==`, `~=` (needs `tol`), `<`, `<=`, `>`, `>=`, `in`, `between`,
`is-null`, `not-null`, `matches` (regex), `monotonic-asc`, `monotonic-desc`.

A case may also carry `"expect_outcome": "fail"` where the point of the test is
that the current build is expected *not* to satisfy the property. That is how a
known defect is recorded without it masquerading as a passing test.

## Running

```sh
node _qa/eval/check-freeze.mjs          # expectations unchanged since authoring
node _qa/run/<tool>.run.mjs             # drives the real page -> results/<tool>.actual.json
node _qa/eval/evaluate.mjs <tool>       # -> results/<tool>.verdict.json
node _qa/eval/report.mjs                # roll-up across all tools
```
