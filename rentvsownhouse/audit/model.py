#!/usr/bin/env python3
"""
Independent re-implementation of the Rent-vs-Own engine following TEXTBOOK
mortgage amortization accounting. It mirrors the app's modelling *structure*
(auto-budget, surplus invested at RFR, ongoing costs, house growth) so that any
difference against the JS app isolates a genuine mortgage-accounting deviation.

Standards applied here that the app may or may not follow:
  S1. The final (payoff) payment is reduced to exactly clear the balance — a
      borrower never pays more than interest + outstanding principal.
  S2. Principal repaid in a year == opening balance - closing balance
      (the amortization identity always reconciles).
  S3. Cash outflow for the mortgage == interest + principal actually paid.
Everything else (budget rule, RFR compounding convention, growth timing) is
deliberately kept identical to the app to avoid spurious differences.
"""
import json, math, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))

def to_yearly(val, freq):
    if freq == 'weekly':  return val * 52
    if freq == 'monthly': return val * 12
    return val

def to_monthly(val, freq):
    if freq == 'weekly':  return val * 52 / 12
    if freq == 'yearly':  return val / 12
    return val

def calc_monthly_mortgage(principal, annual_rate, term_years, mtype):
    r = annual_rate / 100 / 12
    n = term_years * 12
    if mtype == 'io':       return principal * r
    if r == 0:              return principal / n
    return principal * (r * (1 + r) ** n) / ((1 + r) ** n - 1)

def build_schedule(loan, term, mtype, years, rate):
    """Replicates the app's per-year payment schedule (single fixed rate)."""
    sched = []
    principal = loan
    for my in range(1, years + 1):
        r12 = rate / 100 / 12
        pay = 0.0
        if principal > 1e-2:
            if mtype == 'io':
                pay = principal * r12
            elif my <= term:
                pay = calc_monthly_mortgage(principal, rate, term - my + 1, 'pi')
        pstart = principal
        if mtype != 'io' and pay > 0:
            for _ in range(12):
                if principal <= 1e-2:
                    principal = 0; break
                intr = principal * r12
                principal = max(0, principal - min(pay - intr, principal))
        sched.append({'rate': rate, 'r12': r12, 'pay': pay,
                      'pstart': pstart, 'pend': principal})
    return sched

def setup_cost_total(C, price):
    if C['setupCostType'] == 'pct':
        return price * C['setupCost'] / 100
    return C['setupCost']

def own_ongoing_yearly(C, yr, prop_value):
    if C['ownOngoingCostType'] == 'pct':
        return prop_value * C['ownOngoingCost'] / 100
    return to_yearly(C['ownOngoingCost'], C['ownOngoingCostFreq']) * \
           (1 + C['ownOngoingInflation'] / 100) ** (yr - 1)

def rent_ongoing_yearly(C, yr, rent_monthly):
    if C['rentOngoingCostType'] == 'pct':
        return rent_monthly * 12 * C['rentOngoingCost'] / 100
    return to_yearly(C['rentOngoingCost'], C['rentOngoingCostFreq']) * \
           (1 + C['rentOngoingInflation'] / 100) ** (yr - 1)

def compute(C):
    P   = C['propertyPrice']
    dp  = P * C['downPaymentPct'] / 100
    loan = P - dp
    rfr = C['riskFreeRate'] / 100
    h   = C['houseGrowth'] / 100
    ri  = C['rentInflation'] / 100
    setup = setup_cost_total(C, P)
    schedYears = max(C['horizon'], 1)
    sched = build_schedule(loan, C['mortgageTerm'], C['mortgageType'], schedYears, C['mortgageRate'])
    def pay_at(yr): return sched[min(max(yr, 1), len(sched)) - 1]['pay']
    rent_m0 = to_monthly(C['rentAmount'], C['rentFreq'])
    rent_ong0 = rent_ongoing_yearly(C, 1, rent_m0)

    def own_req_monthly(yr):
        pv = P * (1 + h) ** max(0, yr - 1)
        return pay_at(yr) + own_ongoing_yearly(C, yr, pv) / 12
    def rent_req_monthly(yr):
        cur = rent_m0 * (1 + ri) ** (yr - 1)
        return cur + rent_ongoing_yearly(C, yr, cur) / 12

    rtb_enabled = C['rtbEnabled']
    buyYear = C['rtbBuyYear']
    rtb_price0 = P * (1 + h) ** buyYear if rtb_enabled else 0
    rtb_setup0 = setup_cost_total(C, rtb_price0) if rtb_enabled else 0
    rtb_dp0 = rtb_price0 * C['downPaymentPct'] / 100 if rtb_enabled else 0
    rtb_loan0 = max(0, rtb_price0 - rtb_dp0) if rtb_enabled else 0
    rtb_sched0 = build_schedule(rtb_loan0, C['mortgageTerm'], C['mortgageType'], schedYears, C['mortgageRate']) if rtb_enabled else None

    def rtb_req_monthly(yr):
        if not rtb_enabled: return 0
        if yr <= buyYear: return rent_req_monthly(yr)
        pv = P * (1 + h) ** max(0, yr - 1)
        owned = yr - buyYear
        m = rtb_sched0[min(owned, len(rtb_sched0)) - 1]['pay'] if owned >= 1 else 0
        return m + own_ongoing_yearly(C, yr, pv) / 12

    def auto_budget(yr):
        return max(own_req_monthly(yr), rent_req_monthly(yr), rtb_req_monthly(yr))

    budget_manual = C['monthlyBudget'] > 0
    budget0 = C['monthlyBudget']
    budget_growth = C['monthlyBudgetIncrease'] / 100 if budget_manual else 0

    requiredNow = dp + setup
    rentFirstYearCost = rent_m0 * 12 + rent_ong0
    requiredRTBFut = (rtb_dp0 + rtb_setup0) if rtb_enabled else 0
    pvRTB = requiredRTBFut / (1 + rfr) ** buyYear if (rtb_enabled and (1 + rfr) > 0) else requiredRTBFut
    autoInitialCash = max(requiredNow, rentFirstYearCost, pvRTB)
    initialCash = C['initialCash'] if C['initialCash'] > 0 else autoInitialCash
    ownCashStart = initialCash - requiredNow
    renterStart = initialCash

    rfm = (1 + rfr) ** (1 / 12) - 1

    ownPropValue = P; ownPrincipal = loan; ownCash = ownCashStart
    ownAccumCost = setup; ownAccumInterest = 0
    rentCash = renterStart; rentAccumCost = 0

    own_rows = [dict(year=0, ownBegCash=0, ownYearBudget=0, ownYearPrincipal=0,
                     ownYearInterest=0, ownYearOngoing=0, ownYearInterestInc=0,
                     ownYearSurplus=0, ownCash=ownCash, ownRateYr=None,
                     ownPropValue=ownPropValue, ownPrincipal=ownPrincipal,
                     ownHouseEquity=ownPropValue - ownPrincipal,
                     ownNetEquity=ownPropValue - ownPrincipal + ownCash,
                     ownAccumCost=setup)]
    rent_rows = [dict(year=0, rentBegCash=0, ownYearBudget=0, rentRent=rent_m0 * 12,
                      rentYearOngoing=0, rentYearInterestInc=0, rentYearSurplus=0,
                      rentCash=rentCash, rentNetEquity=rentCash, rentAccumCost=0)]

    for yr in range(1, C['horizon'] + 1):
        ys = sched[yr - 1]; mPay = ys['pay']; r12 = ys['r12']
        curRent = rent_m0 * (1 + ri) ** (yr - 1)
        oom = own_ongoing_yearly(C, yr, ownPropValue) / 12
        rom = rent_ongoing_yearly(C, yr, curRent) / 12
        manualBudget = budget0 * (1 + budget_growth) ** (yr - 1) if budget_manual else None

        ownBeg = ownCash; rentBeg = rentCash
        yearInterest = 0; ownYearActualPmt = 0; ownYearPrincipalPaid = 0
        ownYearBudget = 0; ownYearOngoing = 0; rentYearOngoing = 0
        ownYearIntInc = 0; rentYearIntInc = 0; rentYearCost = 0; ownYearCost = 0

        for m in range(12):
            hasMort = ownPrincipal > 1e-2
            mBudget = manualBudget if budget_manual else auto_budget(yr)
            ownYearBudget += mBudget

            mInterest = 0; principalPaid = 0; actualPay = 0
            if hasMort:
                mInterest = ownPrincipal * r12
                if C['mortgageType'] == 'pi':
                    principalPaid = min(mPay - mInterest, ownPrincipal)  # capped
                else:
                    principalPaid = 0
                # STANDARD: pay only what is owed (final payment shrinks)
                actualPay = mInterest + principalPaid
                ownPrincipal = max(0, ownPrincipal - principalPaid)
                ownAccumInterest += mInterest
                yearInterest += mInterest
                ownYearPrincipalPaid += principalPaid
            ownYearActualPmt += actualPay

            mOwnCost = actualPay + oom
            mRentCost = curRent + rom

            ownYearIntInc += ownCash * rfm
            rentYearIntInc += rentCash * rfm
            ownCash = ownCash * (1 + rfm) + (mBudget - mOwnCost)
            rentCash = rentCash * (1 + rfm) + (mBudget - mRentCost)

            ownYearOngoing += oom; rentYearOngoing += rom
            ownCostThisMonth = (mInterest + oom) if C['costInterestOnly'] else mOwnCost
            ownAccumCost += ownCostThisMonth; ownYearCost += ownCostThisMonth
            rentAccumCost += mRentCost; rentYearCost += mRentCost

        ownYearSurplus = ownYearBudget - ownYearActualPmt - ownYearOngoing
        rentYearSurplus = ownYearBudget - rentYearCost
        ownPropValue *= (1 + h)
        ownHouseEquity = ownPropValue - ownPrincipal
        own_rows.append(dict(year=yr, ownBegCash=ownBeg, ownYearBudget=ownYearBudget,
            ownYearPrincipal=ownYearPrincipalPaid, ownYearInterest=yearInterest,
            ownYearOngoing=ownYearOngoing, ownYearInterestInc=ownYearIntInc,
            ownYearSurplus=ownYearSurplus, ownCash=ownCash,
            ownRateYr=ys['rate'] if (yearInterest > 0 or ownYearPrincipalPaid > 0) else None,
            ownPropValue=ownPropValue, ownPrincipal=ownPrincipal,
            ownHouseEquity=ownHouseEquity, ownNetEquity=ownHouseEquity + ownCash,
            ownAccumCost=ownAccumCost))
        rent_rows.append(dict(year=yr, rentBegCash=rentBeg, ownYearBudget=ownYearBudget,
            rentRent=curRent * 12, rentYearOngoing=rentYearOngoing,
            rentYearInterestInc=rentYearIntInc, rentYearSurplus=rentYearSurplus,
            rentCash=rentCash, rentNetEquity=rentCash, rentAccumCost=rentAccumCost))

    result = dict(own=own_rows, rent=rent_rows, initialCash=initialCash)
    if rtb_enabled:
        result['rtb'] = compute_rtb(C, rent_m0, initialCash, auto_budget, rtb_sched0,
                                    budget_manual, budget0, budget_growth)
    return result

def compute_rtb(C, rent_m0, initialCash, auto_budget, rtb_sched,
                budget_manual, budget0, budget_growth):
    h = C['houseGrowth'] / 100; ri = C['rentInflation'] / 100
    rfr = C['riskFreeRate'] / 100; rfm = (1 + rfr) ** (1 / 12) - 1
    buyYear = C['rtbBuyYear']; P0 = C['propertyPrice']
    rtbCash = initialCash; rtbAccumCost = 0; rtbAccumInterest = 0
    rtbPropValue = 0; rtbPrincipal = 0; rtbCash2 = 0
    rows = [dict(year=0, phase='rent', rtbCash=rtbCash, rtbCash2=0, rtbNetEquity=rtbCash,
                 rtbAccumCost=0, rtbPropValue=0, rtbPrincipal=0, rtbHouseEquity=0)]
    for yr in range(1, C['horizon'] + 1):
        curRent = rent_m0 * (1 + ri) ** (yr - 1)
        if yr <= buyYear:
            rom = rent_ongoing_yearly(C, yr, curRent) / 12
            beg = rtbCash; yB = 0; yC = 0; yIntInc = 0; yOng = 0
            for m in range(12):
                mRentCost = curRent + rom
                mBudget = budget0 * (1 + budget_growth) ** (yr - 1) if budget_manual else auto_budget(yr)
                yIntInc += rtbCash * rfm
                rtbCash = rtbCash * (1 + rfm) + (mBudget - mRentCost)
                yB += mBudget; yC += mRentCost; yOng += mRentCost
                rtbAccumCost += mRentCost
            if yr == buyYear:
                priceAtBuy = P0 * (1 + h) ** buyYear
                setupAtBuy = setup_cost_total(C, priceAtBuy)
                dpAtBuy = priceAtBuy * C['downPaymentPct'] / 100
                rtbCash2 = rtbCash - (dpAtBuy + setupAtBuy)
                rtbAccumCost += setupAtBuy
                rtbPrincipal = max(0, priceAtBuy - dpAtBuy)
                rtbPropValue = priceAtBuy
                he = rtbPropValue - rtbPrincipal
                rows.append(dict(year=yr, phase='buy-transition', rtbCash=rtbCash2, rtbCash2=rtbCash2,
                    rtbNetEquity=he + rtbCash2, rtbAccumCost=rtbAccumCost, rtbPropValue=rtbPropValue,
                    rtbPrincipal=rtbPrincipal, rtbHouseEquity=he, rtbBegCash=beg, rtbYearBudget=yB,
                    rtbYearCost=yC, rtbYearOngoing=yOng, rtbYearInterestInc=yIntInc,
                    rtbYearInterest=0, rtbYearPrincipal=0, rtbYearSurplus=yB - yC))
                continue
            rows.append(dict(year=yr, phase='rent', rtbCash=rtbCash, rtbCash2=0, rtbNetEquity=rtbCash,
                rtbAccumCost=rtbAccumCost, rtbPropValue=0, rtbPrincipal=0, rtbHouseEquity=0,
                rtbBegCash=beg, rtbYearBudget=yB, rtbYearCost=yC, rtbYearOngoing=yOng,
                rtbYearInterestInc=yIntInc, rtbYearInterest=0, rtbYearPrincipal=0, rtbYearSurplus=yB - yC))
        else:
            oom = own_ongoing_yearly(C, yr, rtbPropValue) / 12
            my = yr - buyYear
            sy = rtb_sched[min(my, len(rtb_sched)) - 1]
            mPay = sy['pay']; r12 = sy['r12']
            beg = rtbCash2; yInt = 0; yPrin = 0; yB = 0; yIntInc = 0; yOng = 0; yActual = 0; yCost = 0
            for m in range(12):
                hasMort = rtbPrincipal > 1e-2
                mInterest = 0; principalPaid = 0; actualPay = 0
                if hasMort:
                    mInterest = rtbPrincipal * r12
                    principalPaid = min(mPay - mInterest, rtbPrincipal) if C['mortgageType'] == 'pi' else 0
                    actualPay = mInterest + principalPaid
                    rtbPrincipal = max(0, rtbPrincipal - principalPaid)
                    rtbAccumInterest += mInterest; yInt += mInterest; yPrin += principalPaid
                yActual += actualPay
                mOwnCost = actualPay + oom
                mBudget = budget0 * (1 + budget_growth) ** (yr - 1) if budget_manual else auto_budget(yr)
                yIntInc += rtbCash2 * rfm
                rtbCash2 = rtbCash2 * (1 + rfm) + (mBudget - mOwnCost)
                yB += mBudget; yOng += oom
                yCost += (mInterest + oom) if C['costInterestOnly'] else mOwnCost
            rtbAccumCost += yCost
            rtbPropValue *= (1 + h)
            he = rtbPropValue - rtbPrincipal
            rows.append(dict(year=yr, phase='own', rtbCash=rtbCash2, rtbCash2=rtbCash2,
                rtbNetEquity=he + rtbCash2, rtbAccumCost=rtbAccumCost, rtbPropValue=rtbPropValue,
                rtbPrincipal=rtbPrincipal, rtbHouseEquity=he, rtbBegCash=beg, rtbYearBudget=yB,
                rtbYearCost=yCost, rtbYearOngoing=yOng, rtbYearInterestInc=yIntInc,
                rtbYearInterest=yInt, rtbYearPrincipal=yPrin, rtbYearSurplus=yB - yActual - yOng,
                rtbRateYr=sy['rate']))
    return rows

# ── CSV writers matching cashflow-export.js column order + toFixed(0) ──
def f0(x): return str(int(round(float(x or 0))))
def own_csv(rows):
    head = ['Year','Beg_Cash','Ann_Budget','Principal_Exp','Interest_Exp','Ongoing_Exp','Interest_Inc','Surplus','End_Cash','Rate_Pct','Prop_Value','Principal_Left','House_Equity','Net_Equity','Accum_Cost']
    out = [','.join(head)]
    for r in rows:
        y0 = r['year'] == 0
        hasLoan = (not y0) and (r.get('ownYearInterest',0) > 0 or r.get('ownYearPrincipal',0) > 0)
        out.append(','.join([str(r['year']),
            '' if y0 else f0(r['ownBegCash']), '' if y0 else f0(r['ownYearBudget']),
            '' if y0 else f0(r['ownYearPrincipal']), '' if y0 else f0(r['ownYearInterest']),
            '' if y0 else f0(r['ownYearOngoing']), '' if y0 else f0(r['ownYearInterestInc']),
            '' if y0 else f0(r['ownYearSurplus']), f0(r['ownCash']),
            ('%.2f' % r['ownRateYr']) if (hasLoan and r.get('ownRateYr') is not None) else '',
            f0(r['ownPropValue']), f0(r['ownPrincipal']), f0(r['ownHouseEquity']),
            f0(r['ownNetEquity']), f0(r['ownAccumCost'])]))
    return '\n'.join(out)
def rent_csv(rows):
    head = ['Year','Beg_Cash','Ann_Budget','Rent_Exp','Ongoing_Exp','Interest_Inc','Surplus','End_Cash','Net_Equity','Accum_Cost']
    out = [','.join(head)]
    for r in rows:
        y0 = r['year'] == 0
        out.append(','.join([str(r['year']),
            '' if y0 else f0(r['rentBegCash']), '' if y0 else f0(r['ownYearBudget']),
            '' if y0 else f0(r['rentRent']), '' if y0 else f0(r['rentYearOngoing']),
            '' if y0 else f0(r['rentYearInterestInc']), '' if y0 else f0(r['rentYearSurplus']),
            f0(r['rentCash']), f0(r['rentNetEquity']), '' if y0 else f0(r['rentAccumCost'])]))
    return '\n'.join(out)
def rtb_csv(rows):
    head = ['Year','Phase','Beg_Cash','Ann_Budget','Total_Exp','Principal_Exp','Interest_Exp','Ongoing_Exp','Interest_Inc','Surplus','End_Cash','Rate_Pct','Prop_Value','Principal_Left','House_Equity','Net_Equity','Accum_Cost']
    out = [','.join(head)]
    for r in rows:
        y0 = r['year'] == 0; own = r['phase'] != 'rent'
        cash = r['rtbCash'] if r['phase'] == 'rent' else r['rtbCash2']
        tot = r.get('rtbYearPrincipal',0) + r.get('rtbYearInterest',0) + r.get('rtbYearOngoing',0)
        hasLoan = own and r.get('rtbRateYr') is not None and (r.get('rtbYearInterest',0) > 0 or r.get('rtbYearPrincipal',0) > 0)
        out.append(','.join([str(r['year']), r['phase'],
            '' if y0 else f0(r['rtbBegCash']), '' if y0 else f0(r['rtbYearBudget']),
            '' if y0 else f0(tot),
            '' if (y0 or not own) else f0(r['rtbYearPrincipal']),
            '' if (y0 or not own) else f0(r['rtbYearInterest']),
            '' if y0 else f0(r['rtbYearOngoing']), '' if y0 else f0(r['rtbYearInterestInc']),
            '' if y0 else f0(r['rtbYearSurplus']), f0(cash),
            ('%.2f' % r['rtbRateYr']) if hasLoan else '',
            '' if (y0 or not own) else f0(r['rtbPropValue']),
            '' if (y0 or not own) else f0(r['rtbPrincipal']),
            '' if (y0 or not own) else f0(r['rtbHouseEquity']),
            f0(r['rtbNetEquity']), '' if y0 else f0(r['rtbAccumCost'])]))
    return '\n'.join(out)

def main():
    cases = json.load(open(os.path.join(HERE, 'cases.json')))
    os.makedirs(os.path.join(HERE, 'py_out'), exist_ok=True)
    summary = {}
    for C in cases:
        res = compute(C)
        name = C['name']
        open(os.path.join(HERE, 'py_out', f'{name}_own.csv'), 'w').write(own_csv(res['own']))
        open(os.path.join(HERE, 'py_out', f'{name}_rent.csv'), 'w').write(rent_csv(res['rent']))
        if 'rtb' in res:
            open(os.path.join(HERE, 'py_out', f'{name}_rtb.csv'), 'w').write(rtb_csv(res['rtb']))
        last_o = res['own'][-1]; last_r = res['rent'][-1]
        summary[name] = dict(
            initialCash=round(res['initialCash']),
            own_netEquity=round(last_o['ownNetEquity']), own_cash=round(last_o['ownCash']),
            own_houseEquity=round(last_o['ownHouseEquity']), own_principalLeft=round(last_o['ownPrincipal']),
            own_accumCost=round(last_o['ownAccumCost']),
            rent_netEquity=round(last_r['rentNetEquity']), rent_accumCost=round(last_r['rentAccumCost']),
            diff=round(last_o['ownNetEquity'] - last_r['rentNetEquity']))
        if 'rtb' in res:
            summary[name]['rtb_netEquity'] = round(res['rtb'][-1]['rtbNetEquity'])
    json.dump(summary, open(os.path.join(HERE, 'py_out', 'summary.json'), 'w'), indent=2)
    print(json.dumps(summary, indent=2))

if __name__ == '__main__':
    main()
