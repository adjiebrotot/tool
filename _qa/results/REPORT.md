# Financial tools — regression run

Run assembled 2026-09-19T01:32:03.556Z.

| Tool | Pass | Fail | Known-bad confirmed | Known-bad now passing | Could not run |
| --- | ---: | ---: | ---: | ---: | ---: |
| financingvscash | 3 | 8 | 1 | 0 | 0 |
| rentvsownhouse | 2 | 6 | 0 | 0 | 5 |
| **total** | **5** | **14** | **1** | **0** | **5** |

## Findings

### financingvscash N1 — FAIL (blocker)

*Expected on the basis of:* Standard amortising loan of 50,000 at 3% p.a. compound-converted to monthly, 60 repayments; investment of the untouched 50,000 at 4.5% p.a. compound-converted to monthly with each repayment withdrawn at period end; cash path has zero leftover so cash wealth is 0. Conventions used in every expectation of this file: (1) loan period rate = (1+r)^(1/m)-1, the compound conversion the page's Repayment Frequency and Finance Rate tooltips describe ('compound-converted from the annual rate', 'so each payment is exact'); (2) level repayment = P*i/(1-(1+i)^-n) in arrears; (3) the invested balance starts at available cash - down payment - origination fee (Origination Fee tooltip: 'comes out of your cash at the start, so it reduces what you have left to invest'), grows for one period at (1+rf)^(1/m)-1 (the same compound conversion, so that m periods reproduce the annual rf the Cash Purchase Wealth tooltip promises), then the repayment plus the per-payment admin fee is withdrawn at the end of the period; (4) ending wealth = invested balance - loan balance (loan balance is 0 after the last repayment); (5) cash-purchase wealth = (cash - cost)*(1+rf)^years over the scenario's own term (per scenario) and over the longest term for the KPI, exactly as the Cash Purchase Wealth tooltip says; (6) net benefit = ending wealth - cash-purchase wealth at the same horizon. Where an alternative convention would give a materially different number it is quoted in the 'why' so a failing check can be diagnosed.

- `kpi_net_benefit` expected ~= `2181.62`, observed `2200` (Δ=18.38 (tol 1))
  - KPI tooltip: best scenario's end-of-term wealth minus cash wealth = 2181.6193 - 0.

- `kpi_interest` expected ~= `3852.13`, observed `3900` (Δ=47.87 (tol 0.5))
  - Total interest over the term = 3852.1279; no fees to exclude.

### rentvsownhouse N1 — FAIL (blocker)

*Expected on the basis of:* Standard annuity (nominal APR/12), closed-form balance, yearly cash conservation end = begin x (1+rf) + budget - outflow, auto budget = max(own, rent) per year.

- `budgetMonthlyMin` expected ~= `4337.12`, observed `4000` (Δ=337.1 (tol 1))
  - Auto budget each year = max(own outflow, rent outflow) (documented in TESTCASES R9). Year 1: own = 12 x 3,837.12 + 6,000 = 52045.48 > rent 34,800, and own outflow is constant while rent rises, so the minimum yearly budget is 52045.48 -> /12 = 4337.12.

- `rentCashEndY1` expected ~= `217885.48`, observed `218238` (Δ=352.5 (tol 5))
  - Yearly identity: 192,000 x 1.045 + 52045.48 - 34,800 = 217885.48.

- `ownCashIdentityResidualMaxAbs` expected ~= `0`, observed `579.0550000000512` (Δ=579.1 (tol 5))
  - Yearly cash conservation: end = begin x (1+rf) + budget - outflow, for every year. Tolerance covers whole-dollar display rounding of four terms.

- `rentCashIdentityResidualMaxAbs` expected ~= `0`, observed `353` (Δ=353.0 (tol 5))
  - Same identity on the rent path.

*Runner notes:* Series from the page's own CSV export (integer precision); the on-screen table is compact so it cannot carry the residual checks.

### rentvsownhouse R1 — FAIL (blocker)

*Expected on the basis of:* One household budget: every path is credited the identical budget in every year, whichever mode produced it.

- `B_kpiBudgetMonthlyMax` expected ~= `8879.22`, observed `9000` (Δ=120.8 (tol 1))
  - Year-30 budget / 12 = 8879.2235.

*Runner notes:* IMPORTANT: the page's rent CSV writes the Own budget field into the Rent budget column, so an own-vs-rent budget difference read from the export is 0 by construction and cannot independently confirm parity. The RTB comparison in states C and D is the part that carries information.

### rentvsownhouse R7 — FAIL (blocker)

*Expected on the basis of:* At the purchase the renter's cash buys the grown-price house: cash falls by down payment + setup, a loan of (1 - deposit%) x price is taken, and thereafter the path is an owner. Nothing else is created or destroyed.

- `A_rtbMinusRentCashMaxAbsY1to5` expected ~= `0`, observed `236205` (Δ=2.362e+5 (tol 0.5))
  - Until it buys, the RTB path IS the rent path: same budget, same rent.

- `A_rtbPurchasePrice` expected ~= `1021025.25`, observed `1072077` (Δ=5.105e+4 (tol 1))
  - The house has grown for 5 years: 800,000 x 1.05^5 = 1021025.25.

- `A_rtbConservationResidualY6` expected ~= `-246834.28`, observed `null` (Δ=2.468e+5 (tol 5))
  - Money leaves cash only for the purchase: down payment 204205.05 + setup 32,000 = 236205.05 at the end of year 5, which then forgoes one year at rf: -236205.05 x 1.045 = -246834.28.

- `A_rtbCashEndY6` expected ~= `131151.97`, observed `133770` (Δ=2618 (tol 5))
  - (366271.05 - 236205.05) x 1.045 + 60,000 - (58767.0 + 6,000) = 131151.97 (yearly identity; rent cash_5 = 192,000 x 1.045^5 + sum of yearly surpluses).

- `A_rtbCashIdentityResidualMaxAbsY7toEnd` expected ~= `0`, observed `98.35999999998603` (Δ=98.36 (tol 5))
  - After the purchase the RTB path obeys the owner identity.

- `B_rentCashEndY5` expected ~= `8168.9`, observed `8081` (Δ=87.90 (tol 5))
  - 10,000 x 1.045^5 plus yearly surpluses (36,000 - rent outflow_t) compounded: 8168.9.

- `B_rtbConservationResidualY6` expected ~= `-246834.28`, observed `null` (Δ=2.468e+5 (tol 5))
  - Conservation is unconditional: same outlay, same identity, even when cash is insufficient.

- `B_rtbLoanAtPurchase` expected ~= `816820.2`, observed `806790` (Δ=1.003e+4 (tol 1))
  - The loan is still 80% of the grown price; the shortfall does not change the mortgage.

- `C_ownCashEndY1` expected ~= `1897314.52`, observed `1897477` (Δ=162.5 (tol 5))
  - 1,808,000 x 1.045 + 60,000 - 52045.48 = 1897314.52.

- `C_rtbLoanAtPurchase` expected ~= `816820.2`, observed `806790` (Δ=1.003e+4 (tol 1))
  - The configured 20% down payment applies regardless of how much cash there is.

- `C_rtbConservationResidualY6` expected ~= `-246834.28`, observed `null` (Δ=2.468e+5 (tol 5))
  - Same outlay, same identity.

- `D_rtbPurchasePrice` expected ~= `840000`, observed `882000` (Δ=4.200e+4 (tol 0.5))
  - 800,000 x 1.05 after one year of renting.

- `D_rtbMinusRentCashY1` expected ~= `0`, observed `-200000` (Δ=2.000e+5 (tol 0.5))
  - Identical to the rent path during year 1.

- `D_rtbConservationResidualY2` expected ~= `-209000`, observed `null` (Δ=2.090e+5 (tol 5))
  - -(168,000 + 32,000) x 1.045 = -209000.0.

- `D_rtbCashEndY2` expected ~= `32655.05`, observed `33310` (Δ=655.0 (tol 5))
  - (225,840 - 200,000) x 1.045 + 60,000 - (48347.75 + 6,000) = 32655.05.

- `E_rtbMinusRentCashMaxAbsY1to29` expected ~= `0`, observed `690582` (Δ=6.906e+5 (tol 0.5))
  - Renting for the whole horizon: the paths coincide.

- `E_rtbNetEquityY30MinusRent` expected between `[-32000.5,0.5]`, observed `16414`
  - Buying at the very end converts the down payment into equity and spends the 32,000 setup cost (net equity = rent - 32,000); not buying leaves it equal to rent. Either reading is legitimate; anything else is not.

*Runner notes:* The RTB conservation residuals are reported null: the export does not expose the purchase-year deposit and setup outlay as its own column, so the residual cannot be assembled from page figures without assuming the transition formula, which the contract forbids. Every other RTB observable is read from the page's RTB CSV.

### financingvscash F1-alt — CONFIRMED DEFECT (major)

*Expected on the basis of:* Same state and observables as F1. These are the figures the page would print if it used the nominal r/m convention that the rest of the repo uses (TESTCASES F1). The page's own tooltips promise the effective convention, so this case is expected to fail (XFAIL). If it XPASSes, the live convention is nominal and the tooltips are wrong.

- `payment_F1` expected ~= `1112.22`, observed `1096.78` (Δ=15.44 (tol 0.01))
  - Nominal: i=0.12/12=0.01; 50000*0.01/(1-1.01^-60)=1112.2224.

- `interest_p1_F1` expected ~= `500`, observed `474.44` (Δ=25.56 (tol 0.01))
  - Nominal: 50000*0.01 = 500.

- `sum_interest_F1` expected ~= `16733.34`, observed `15807.090000000002` (Δ=926.2 (tol 0.5))
  - Nominal: 60*1112.2224-50000=16733.3431.

- `end_invest_F1z` expected ~= `6635.16`, observed `6482.63287977385` (Δ=152.5 (tol 1))
  - Nominal rf: 50000*(1+0.045/12)^60 - 833.3333*((1+0.00375)^60-1)/0.00375 = 6635.1642.

*Runner notes:* Same measurement as F1; the two cases are rival conventions scored against one observation.

### financingvscash F2 — FAIL (major)

*Expected on the basis of:* Down payment 90% of 50,000 = 45,000 plus a 4,000 flat origination fee leave 1,000 invested; the 5,000 financed at 0% costs 416.67 a month, so the invested balance crosses zero in month 3 and the overdraft compounds at 4.5% p.a. (monthly (1.045)^(1/12)-1) for the rest of the year. The Available Cash tooltip only requires cash >= cost (50,000 = 50,000), and upfront outlay 49,000 < 50,000 so the scenario is affordable. Conventions used in every expectation of this file: (1) loan period rate = (1+r)^(1/m)-1, the compound conversion the page's Repayment Frequency and Finance Rate tooltips describe ('compound-converted from the annual rate', 'so each payment is exact'); (2) level repayment = P*i/(1-(1+i)^-n) in arrears; (3) the invested balance starts at available cash - down payment - origination fee (Origination Fee tooltip: 'comes out of your cash at the start, so it reduces what you have left to invest'), grows for one period at (1+rf)^(1/m)-1 (the same compound conversion, so that m periods reproduce the annual rf the Cash Purchase Wealth tooltip promises), then the repayment plus the per-payment admin fee is withdrawn at the end of the period; (4) ending wealth = invested balance - loan balance (loan balance is 0 after the last repayment); (5) cash-purchase wealth = (cash - cost)*(1+rf)^years over the scenario's own term (per scenario) and over the longest term for the KPI, exactly as the Cash Purchase Wealth tooltip says; (6) net benefit = ending wealth - cash-purchase wealth at the same horizon. Where an alternative convention would give a materially different number it is quoted in the 'why' so a failing check can be diagnosed.

- `kpi_net_benefit` expected ~= `-4057.31`, observed `-4100` (Δ=42.69 (tol 0.5))
  - Cash path leftover is 0, so net benefit = ending wealth.

*Runner notes:* Invested balance read directly from the page's own Investment Value chart metric, not reconstructed.

### financingvscash F3 — FAIL (major)

*Expected on the basis of:* 'toobig' needs 50% x 50,000 + 30,000 = 55,000 upfront against 50,000 of cash, so it cannot be executed; the page must say so and carry on with 'affordable', whose numbers are the N1 baseline (3% vs 4.5%, no fees).

- `kpi_net_benefit` expected ~= `2181.62`, observed `2200` (Δ=18.38 (tol 1))
  - Same maths as N1: 2181.6193.

### financingvscash F5 — FAIL (major)

*Expected on the basis of:* All three scenarios run for exactly two years: 24 monthly, 104 weekly, and 104 weeks fortnightly (the Term tooltip says the field is counted in 'weeks for weekly and fortnightly, months for monthly, years for yearly', so 104 weeks at fortnightly = 52 repayments). The frequency tooltip fixes 52 / 26 / 12 / 1 payments a year. Time alignment: each series' last point must sit at the same x (two years), whatever unit the axis uses, so the ratio of last-x values is 1 (it would be 104/24 = 4.33 on a period-index axis). Re-deriving the term on a frequency edit keeps the duration: 24 months -> 104 weeks -> 104 weeks (fortnightly, unit still weeks) -> 2 years -> 24 months. Cash wealth uses the longest term = 2 years. Conventions used in every expectation of this file: (1) loan period rate = (1+r)^(1/m)-1, the compound conversion the page's Repayment Frequency and Finance Rate tooltips describe ('compound-converted from the annual rate', 'so each payment is exact'); (2) level repayment = P*i/(1-(1+i)^-n) in arrears; (3) the invested balance starts at available cash - down payment - origination fee (Origination Fee tooltip: 'comes out of your cash at the start, so it reduces what you have left to invest'), grows for one period at (1+rf)^(1/m)-1 (the same compound conversion, so that m periods reproduce the annual rf the Cash Purchase Wealth tooltip promises), then the repayment plus the per-payment admin fee is withdrawn at the end of the period; (4) ending wealth = invested balance - loan balance (loan balance is 0 after the last repayment); (5) cash-purchase wealth = (cash - cost)*(1+rf)^years over the scenario's own term (per scenario) and over the longest term for the KPI, exactly as the Cash Purchase Wealth tooltip says; (6) net benefit = ending wealth - cash-purchase wealth at the same horizon. Where an alternative convention would give a materially different number it is quoted in the 'why' so a failing check can be diagnosed.

- `kpi_cash_wealth` expected ~= `10920.25`, observed `11900` (Δ=979.8 (tol 0.01))
  - (60000-50000)*1.045^2 = 10920.2500. If the longest term were taken as 104 'months' it would read 14644.50.

- `n_rows_C` expected == `52`, observed `104`
  - 104 weeks at fortnightly = 52 repayments (Term tooltip: unit is weeks for fortnightly).

- `payment_C` expected ~= `1019.8`, observed `539.58` (Δ=480.2 (tol 0.01))
  - i=(1.06)^(1/26)-1; 50000*i/(1-(1+i)^-52) = 1019.7965.

- `end_wealth_C` expected ~= `10134.77`, observed `10243.9` (Δ=109.1 (tol 1))
  - 60000*1.045^2 - 1019.7965*((1+g)^52-1)/g, g=(1.045)^(1/26)-1 -> 10134.7693.

- `chart_last_y_A` expected ~= `10117.04`, observed `11048.05824233362` (Δ=931.0 (tol 1))
  - Chart and table are renderings of one model.

- `chart_last_y_B` expected ~= `10142.36`, observed `11075.713612225567` (Δ=933.4 (tol 1))
  - Chart and table are renderings of one model.

- `term_after_fortnightly` expected == `104`, observed `52`
  - Unit stays weeks for fortnightly per the Term tooltip, so 104 weeks.

*Runner notes:* Chart x values are read from the recorded dataset points; the page plots x as a linear Years axis.

### financingvscash F6 — FAIL (major)

*Expected on the basis of:* Financed = 80% x 50,000 = 40,000. Origination 2% of the financed amount = 800 (Origination Fee tooltip: '%: a percentage of the financed amount'), identical to the 800 flat fee, so the two scenarios must agree in every figure. Admin 10 per repayment x 24 = 240 (Admin Fee tooltip: 'this amount times the number of payments'). Total fees 1,040. Interest = 24 x repayment - 40,000 at 5% compound-converted monthly. Invested start = 50,000 - 10,000 down - 800 fee = 39,200; each month grows at (1.045)^(1/12)-1 then repayment + 10 is withdrawn. Conventions used in every expectation of this file: (1) loan period rate = (1+r)^(1/m)-1, the compound conversion the page's Repayment Frequency and Finance Rate tooltips describe ('compound-converted from the annual rate', 'so each payment is exact'); (2) level repayment = P*i/(1-(1+i)^-n) in arrears; (3) the invested balance starts at available cash - down payment - origination fee (Origination Fee tooltip: 'comes out of your cash at the start, so it reduces what you have left to invest'), grows for one period at (1+rf)^(1/m)-1 (the same compound conversion, so that m periods reproduce the annual rf the Cash Purchase Wealth tooltip promises), then the repayment plus the per-payment admin fee is withdrawn at the end of the period; (4) ending wealth = invested balance - loan balance (loan balance is 0 after the last repayment); (5) cash-purchase wealth = (cash - cost)*(1+rf)^years over the scenario's own term (per scenario) and over the longest term for the KPI, exactly as the Cash Purchase Wealth tooltip says; (6) net benefit = ending wealth - cash-purchase wealth at the same horizon. Where an alternative convention would give a materially different number it is quoted in the 'why' so a failing check can be diagnosed.

- `kpi_interest` expected ~= `2068.81`, observed `0` (Δ=2069 (tol 0.5))
  - Total Interest (Best) tooltip: 'Origination and admin fees are not counted here'.

### financingvscash F7 — FAIL (major)

*Expected on the basis of:* (a) Down Payment tooltip: '100% pays cash outright, so there is no loan at all', so the scenario is the cash path: both sides hold 10,000 compounding at 4.5% for 5 years, net benefit exactly 0, and the Best Strategy tooltip promises 'Break-even when the winner exactly matches cash'. (b) 0% loan: repayment = 50,000/60, zero interest, principal sums to the loan, invested cash compounds as in F1z. (c) A 0-period term is outside the field's min=1; the page must either clamp or reject, never divide by zero. (d)/(e) Available Cash tooltip: 'It must be at least the purchase cost' -> a warning, and no NaN. Conventions used in every expectation of this file: (1) loan period rate = (1+r)^(1/m)-1, the compound conversion the page's Repayment Frequency and Finance Rate tooltips describe ('compound-converted from the annual rate', 'so each payment is exact'); (2) level repayment = P*i/(1-(1+i)^-n) in arrears; (3) the invested balance starts at available cash - down payment - origination fee (Origination Fee tooltip: 'comes out of your cash at the start, so it reduces what you have left to invest'), grows for one period at (1+rf)^(1/m)-1 (the same compound conversion, so that m periods reproduce the annual rf the Cash Purchase Wealth tooltip promises), then the repayment plus the per-payment admin fee is withdrawn at the end of the period; (4) ending wealth = invested balance - loan balance (loan balance is 0 after the last repayment); (5) cash-purchase wealth = (cash - cost)*(1+rf)^years over the scenario's own term (per scenario) and over the longest term for the KPI, exactly as the Cash Purchase Wealth tooltip says; (6) net benefit = ending wealth - cash-purchase wealth at the same horizon. Where an alternative convention would give a materially different number it is quoted in the 'why' so a failing check can be diagnosed.

- `a_kpi_cash_wealth` expected ~= `12461.82`, observed `12500` (Δ=38.18 (tol 0.05))
  - (60000-50000)*1.045^5 = 12461.8194.

### financingvscash F8 — FAIL (major)

*Expected on the basis of:* If the purchased asset were carried in wealth (resale or depreciated value), spending all your cash on it would leave wealth equal to the asset, not zero, and a 100%-down scenario would end above the compounded leftover. Cash Purchase Wealth tooltip: leftover funds compounded, nothing else. Conventions used in every expectation of this file: (1) loan period rate = (1+r)^(1/m)-1, the compound conversion the page's Repayment Frequency and Finance Rate tooltips describe ('compound-converted from the annual rate', 'so each payment is exact'); (2) level repayment = P*i/(1-(1+i)^-n) in arrears; (3) the invested balance starts at available cash - down payment - origination fee (Origination Fee tooltip: 'comes out of your cash at the start, so it reduces what you have left to invest'), grows for one period at (1+rf)^(1/m)-1 (the same compound conversion, so that m periods reproduce the annual rf the Cash Purchase Wealth tooltip promises), then the repayment plus the per-payment admin fee is withdrawn at the end of the period; (4) ending wealth = invested balance - loan balance (loan balance is 0 after the last repayment); (5) cash-purchase wealth = (cash - cost)*(1+rf)^years over the scenario's own term (per scenario) and over the longest term for the KPI, exactly as the Cash Purchase Wealth tooltip says; (6) net benefit = ending wealth - cash-purchase wealth at the same horizon. Where an alternative convention would give a materially different number it is quoted in the 'why' so a failing check can be diagnosed.

- `s2_kpi_cash_wealth` expected ~= `24923.64`, observed `24900` (Δ=23.64 (tol 0.05))
  - (100000-80000)*1.045^5 = 24923.6388.

### financingvscash F10 — FAIL (major)

*Expected on the basis of:* Inflation tooltip: 'ending wealth is also shown in today's dollars, discounted by the inflation rate'. Discounting by the scenario's own horizon means A12 (1 year) is divided by 1.025 and B60 (5 years) by 1.025^5 = 1.1314: the same nominal dollar is worth 12% less after 5 years than after 1, so real figures across different terms are not directly comparable and the page should say so. Each scenario's nominal net benefit is measured against the cash path at its own horizon: A12 vs 10,000 x 1.045, B60 vs 10,000 x 1.045^5. Conventions used in every expectation of this file: (1) loan period rate = (1+r)^(1/m)-1, the compound conversion the page's Repayment Frequency and Finance Rate tooltips describe ('compound-converted from the annual rate', 'so each payment is exact'); (2) level repayment = P*i/(1-(1+i)^-n) in arrears; (3) the invested balance starts at available cash - down payment - origination fee (Origination Fee tooltip: 'comes out of your cash at the start, so it reduces what you have left to invest'), grows for one period at (1+rf)^(1/m)-1 (the same compound conversion, so that m periods reproduce the annual rf the Cash Purchase Wealth tooltip promises), then the repayment plus the per-payment admin fee is withdrawn at the end of the period; (4) ending wealth = invested balance - loan balance (loan balance is 0 after the last repayment); (5) cash-purchase wealth = (cash - cost)*(1+rf)^years over the scenario's own term (per scenario) and over the longest term for the KPI, exactly as the Cash Purchase Wealth tooltip says; (6) net benefit = ending wealth - cash-purchase wealth at the same horizon. Where an alternative convention would give a materially different number it is quoted in the 'why' so a failing check can be diagnosed.

- `kpi_cash_wealth` expected ~= `12461.82`, observed `12500` (Δ=38.18 (tol 0.05))
  - Longest term 5 years: 10000*1.045^5 = 12461.8194.

- `note_text` expected matches `"term|compar"`, observed `"These scenarios run for different lengths. The Cash Purchase column is shown at the longest horizon (5.0 yr), so each shorter scenario is scored against its own same-horizon cash row above, never against the column."`
  - TESTCASES F10: scenarios of different terms are not comparable on real figures without a note.

### rentvsownhouse R2 — FAIL (major)

*Expected on the basis of:* A cash shortfall is an overdraft: it compounds at the same risk-free rate as a surplus. The budget warning is a both-sides test.

- `A_ownCashEndY1` expected ~= `-10045.48`, observed `-10251` (Δ=205.5 (tol 5))
  - 0 x 1.045 + 42,000 - 52045.48 = -10045.48 (implicit borrowing).

- `A_ownCashEndY2` expected ~= `-20543.01`, observed `-20963` (Δ=420.0 (tol 5))
  - -10045.48 x 1.045 + 42,000 - 52045.48 = -20543.01: the overdraft compounds at rf.

- `A_ownCashEndY5` expected ~= `-54955.91`, observed `-56080` (Δ=1124 (tol 5))
  - -10045.48 x (1.045^5 - 1)/0.045 = -54955.91.

- `A_ownCashEndY30` expected ~= `-612845.32`, observed `-625385` (Δ=1.254e+4 (tol 5))
  - -10045.48 x (1.045^30 - 1)/0.045 = -10045.48 x 61.0071 = -612845.32.

- `A_ownCashIdentityResidualMaxAbs` expected ~= `0`, observed `206.82000000000698` (Δ=206.8 (tol 5))
  - Negative cash obeys the same identity as positive cash (TESTCASES R2: implicit borrowing at the risk-free rate).

- `A_rentCashEndY1` expected ~= `207840`, observed `207987` (Δ=147.0 (tol 5))
  - 192,000 x 1.045 + 42,000 - 34,800 = 207,840.

- `B_ownCashEndY1` expected ~= `-28045.48`, observed `-28619` (Δ=573.5 (tol 5))
  - 24,000 - 52045.48 = -28045.48.

- `B_rentCashEndY1` expected ~= `189840`, observed `189619` (Δ=221.0 (tol 5))
  - 192,000 x 1.045 + 24,000 - 34,800 = 189,840.

### rentvsownhouse R3 — FAIL (major)

*Expected on the basis of:* The page has no selling-cost or CGT inputs; net equity must be value - debt + cash with no hidden haircut.

- `kpiDiffMinusFinalDelta` expected ~= `0`, observed `4095` (Δ=4095 (tol 2))
  - KPI sub-label: 'Own minus Rent at final year'.

### rentvsownhouse R4 — NOT RUN (major)

Needs detailed mortgage mode plus a constructed rate-period row (interest-only radio, #ratePeriodRows editing). Not implemented by this runner; state B alone would be misleading without A.

### rentvsownhouse R5 — NOT RUN (major)

Needs a floating rate band (low/mid/high) built in #ratePeriodRows, and a per-path verdict readout the runner could not locate on the page. Not executed.

### rentvsownhouse R6 — NOT RUN (major)

Needs repeated construction and mutation of .rate-period-row entries (past-term, overlapping, reversed bounds, shortened term, backwards band). Not implemented by this runner.

### rentvsownhouse R8 — FAIL (major)

*Expected on the basis of:* Breakeven = first year own net equity exceeds rent net equity; a KPI that reports a later crossing, or a crossing when there is none, is wrong.

- `A_breakevenYear` expected == `1`, observed `null`
  - Year 0: own 160,000 vs rent 192,000 (behind by the setup cost). Year 1 with 10% growth: own = 880,000 - 632140.73 + 0 = 247859.27 vs rent 217885.48 -> ahead from year 1; margin ~30k is convention-proof.

- `C_breakevenYear` expected == `2`, observed `null`
  - KPI sub-label 'When owning net equity overtakes renting': the FIRST crossing, year 2, not the later one at year 16.

- `C_breakevenMinusFirstOvertake` expected == `0`, observed `-2`
  - The KPI must agree with the page's own series (first crossing only, TESTCASES R8).

### rentvsownhouse R9 — NOT RUN (major)

Needs the /sensitivity/ page driven to mirror the baseline field by field through its dynamic table.dt scenario column. Not implemented by this runner.

### rentvsownhouse R12 — NOT RUN (major)

Needs the /id/ page driven through the same baseline and compared field by field. Not implemented by this runner.
