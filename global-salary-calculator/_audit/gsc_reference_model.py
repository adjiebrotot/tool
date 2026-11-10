"""Global Salary Calculator - reference model (spec v11, research date 10 Nov 2026).
v11 adds: NY benefit recapture for all tiers + NY DBL (0.5%, max 0.60/wk); US state engine (25 states + DC, 12 gated);
CH married DBST full official tariff (guard removed); BE 5+ children (+7,070 each) and single-parent supplement (+1,980);
PT dependants / health / education / rent deductions with art.78(7) cap; JP child-support levy months knob;
FR guard relaxed to RFR <= 250,000.
v10 adds: US-NY MFJ + first-tier benefit recapture, US nonresident alien, ID non-resident, BE married + children,
CH-ZH married (+children), FR impatriate 30% forfait, TW Gold Card, Bahrain BHD 4,000 cap.
--- v9 notes ---
v9 adds: CA-ON Ontario Tax Reduction + LIFT (guard removed), CA-BC, CA-AB, CA-QC, US-CA MFJ,
IT > EUR200k, PT minimo de existencia (guard removed), ES SMI deduction (guard removed),
CH-ZH married tariffs + church tax, BE marital quotient (married preset still gated: CSSS married scale)."""
_V8_DOC = """(v8 header)
Locks spec behaviour; golden values in spec §5 are generated from this file.
Every function returns {incomeTax, social, net} (annual, local currency) or 'NOT_SUPPORTED'."""
import math, json
NS='NOT_SUPPORTED'
def prog(x, br):
    t=0; lo=0
    for up,r in br:
        hi = up if up is not None else float('inf')
        if x>lo: t += (min(x,hi)-lo)*r
        lo=hi
    return t
R=lambda v: round(v,2)
def res(tax,soc,g,extra=None):
    d=dict(incomeTax=R(tax),social=R(soc),net=R(g-tax-soc))
    if extra: d['detail']={k:R(v) for k,v in extra.items()}
    return d
# ======================= AU 2026-27 =======================
AU_RES=[(18200,0),(45000,.15),(135000,.30),(190000,.37),(None,.45)]
AU_FOR=[(135000,.30),(190000,.37),(None,.45)]
AU_WHM=[(45000,.15),(135000,.30),(190000,.37),(None,.45)]
def au_lito(x):
    if x<=37500: return 700
    if x<=45000: return 700-0.05*(x-37500)
    if x<=66667: return max(0,325-0.015*(x-45000))
    return 0
def au_medicare(x):
    if x<=28011: return 0
    if x<=35013: return 0.10*(x-28011)
    return 0.02*x
def au(g, preset):
    ti=g-min(1000,g)
    if preset=='pr':   tax=max(0,prog(ti,AU_RES)-au_lito(ti))+au_medicare(ti)
    if preset=='temp': tax=max(0,prog(ti,AU_RES)-au_lito(ti))
    if preset=='foreign': tax=prog(g,AU_FOR)
    if preset=='whm': tax=prog(g,AU_WHM)
    return res(tax,0,g)
# ======================= SG YA2027 =======================
SG=[(20000,0),(30000,.02),(40000,.035),(80000,.07),(120000,.115),(160000,.15),(200000,.18),(240000,.19),(280000,.195),(320000,.20),(500000,.22),(1000000,.23),(None,.24)]
def sg(g, cpf_rate):
    cpf = math.floor(cpf_rate*min(g/12,8000))*12 if cpf_rate else 0
    return res(prog(max(0,g-min(80000,1000+cpf)),SG),cpf,g)
# ======================= UK 2026/27 =======================
def uk(g, region):
    pa=max(0,12570-max(0,(g-100000)/2)); ti=max(0,g-pa)
    tax=prog(ti,[(37700,.20),(125140,.40),(None,.45)]) if region=='rUK' else prog(ti,[(3967,.19),(16956,.20),(31092,.21),(62430,.42),(125140,.45),(None,.48)])
    ni=0.08*max(0,min(g,50270)-12570)+0.02*max(0,g-50270)
    return res(tax,ni,g)
# ======================= DE 2026 =======================
def de_est(x):
    x=math.floor(x)
    if x<=12348: t=0
    elif x<=17799: y=(x-12348)/10000; t=(914.51*y+1400)*y
    elif x<=69878: z=(x-17799)/10000; t=(173.10*z+2397)*z+1034.87
    elif x<=277825: t=0.42*x-11135.63
    else: t=0.45*x-19470.38
    return math.floor(t)
def de_soli(est, joint=False):
    fg=40700 if joint else 20350
    return 0 if est<=fg else min(0.055*est, 0.119*(est-fg))
def de(g, cls='I', church=0.0, childless=True):
    rv=0.093*min(g,101400); av=0.013*min(g,101400)
    kvb=min(g,69750); kv=(0.073+0.029/2)*kvb; pv=(0.018+(0.006 if childless else 0))*kvb
    zve=max(0,g-1230-36-(rv+(0.070+0.029/2)*kvb+pv))
    if cls=='III': est=2*de_est(zve/2); soli=de_soli(est,True)
    else: est=de_est(zve); soli=de_soli(est)
    return res(est+soli+church*est, rv+av+kv+pv, g)
# ======================= US 2026 =======================
USF={'S':(16100,[(12400,.10),(50400,.12),(105700,.22),(201775,.24),(256225,.32),(640600,.35),(None,.37)]),
     'MFJ':(32200,[(24800,.10),(100800,.12),(211400,.22),(403550,.24),(512450,.32),(768700,.35),(None,.37)])}
def us_fed(g, fs):
    sd,br=USF[fs]; return prog(max(0,g-sd),br)
def us_fica(g, fs):
    return 0.062*min(g,184500)+0.0145*g+0.009*max(0,g-(200000 if fs=='S' else 250000))
def us(g, fs):
    return res(us_fed(g,fs),us_fica(g,fs),g)
CA_S=[(11456,.01),(27157,.02),(42861,.04),(59498,.06),(75197,.08),(384109,.093),(460927,.103),(768213,.113),(None,.123)]
CA_MFJ=[(22912,.01),(54314,.02),(85722,.04),(118996,.06),(150394,.08),(768218,.093),(921854,.103),(1536426,.113),(None,.123)]
def us_ca(g, fs='S'):
    if fs not in ('S','MFJ'): return NS
    sd,br,cred=(5900,CA_S,158) if fs=='S' else (11800,CA_MFJ,316)
    st=max(0,prog(max(0,g-sd),br)-cred)+0.01*max(0,g-sd-1e6)   # BHST threshold 1M for all statuses
    sdi=0.013*g
    return res(us_fed(g,fs)+st,us_fica(g,fs)+sdi,g,dict(state=st))
NY_S=[(8500,.039),(11700,.044),(13900,.0515),(80650,.054),(215400,.059),(1077550,.0685),(5e6,.0965),(25e6,.103),(None,.109)]
NYC_S=[(12000,.03078),(25000,.03762),(50000,.03819),(None,.03876)]
NY_MFJ=[(17150,.039),(23600,.044),(27900,.0515),(161550,.054),(323200,.059),(2155350,.0685),(5e6,.0965),(25e6,.103),(None,.109)]
NYC_MFJ=[(21600,.03078),(45000,.03762),(90000,.03819),(None,.03876)]
NY_P={'S':(8000,NY_S,NYC_S,215400,.059),'MFJ':(16050,NY_MFJ,NYC_MFJ,161550,.054)}
def ny_recapture_tax(agi, ti, br, tier_top, tier_rate):
    """NY tax incl. supplemental tax (benefit recapture), Tax Law s.601(d-1), all tiers (v11).
    Tier 1 (ti <= tier_top): sched + (ti*R1 - sched) * min(1,(AGI-107,650)/50,000).
    Higher bracket k with lower edge L_k, rate r_k, previous rate r_(k-1):
      recapture base RB_k = r_(k-1)*L_k - sched(L_k); incremental benefit IB_k = (r_k - r_(k-1))*L_k;
      tax = sched(ti) + RB_k + IB_k * min(1,(AGI-L_k)/50,000).
    Matches the published worksheet amounts to rounding (single 215,400-1,077,550: 568.25 / 2,046.30 vs DTF 567 / 2,047)."""
    st=prog(ti,br)
    if agi<=107650: return st
    if ti<=tier_top:
        return st+(ti*tier_rate-st)*min(1.0,(agi-107650)/50000)
    lo=0; prev_rate=None
    for up,r in br:
        if up is None or ti<=up:
            L=lo; rb=prev_rate*L-prog(L,br); ib=(r-prev_rate)*L
            return st+rb+ib*min(1.0,max(0.0,agi-L)/50000)
        lo=up; prev_rate=r
def us_ny(g, fs='S', nyc=False, dbl=True):
    """v11: benefit recapture modelled for ALL tiers (guard removed); NY DBL employee contribution
    0.5% of wages capped at 0.60/week (NYSIF; employer may collect - knob dbl, default on = 31.20/yr)."""
    if fs not in NY_P: return NS
    sd,br,cbr,tier_top,tier_rate=NY_P[fs]
    agi=g; ti=max(0,agi-sd)
    st=ny_recapture_tax(agi,ti,br,tier_top,tier_rate)
    city=prog(ti,cbr) if nyc else 0
    pfl=min(0.00432*g,411.91)
    dblc=52*min(0.005*g/52,0.60) if dbl else 0
    return res(us_fed(g,fs)+st+city,us_fica(g,fs)+pfl+dblc,g,dict(state=st,city=city,dbl=dblc))
# ---------------- v11: generic state engine (calcsystems.com 2026 schedules, derived from Tax Foundation 2026) ---------------
# entry: (single brackets, MFJ brackets, (std S, std MFJ), (exemption deduction S, MFJ), (exemption credit S, MFJ))
# brackets = list of (upper edge, rate) on taxable income; None = open top.
def _b(edges, rates): return list(zip(list(edges)+[None], rates))
US_ST={
 'AZ':(_b([],[.025]),_b([],[.025]),(16100,32200),(0,0),(0,0)),
 'AR':(_b([5599,11199,15999,26399],[0,.02,.03,.034,.037]),_b([5599,11199,15999,26399],[0,.02,.03,.034,.037]),(2470,4940),(0,0),(29,58)),
 'CO':(_b([],[.044]),_b([],[.044]),(16100,32200),(0,0),(0,0)),
 'DE':(_b([2000,5000,10000,20000,25000,60000],[0,.022,.039,.048,.052,.0555,.066]),_b([2000,5000,10000,20000,25000,60000],[0,.022,.039,.048,.052,.0555,.066]),(3250,6500),(0,0),(110,220)),
 'GA':(_b([],[.0499]),_b([],[.0499]),(15000,30000),(0,0),(0,0)),
 'HI':(_b([9600,14400,19200,24000,36000,48000,125000,175000,225000,275000,325000],[.014,.032,.055,.064,.068,.072,.076,.079,.0825,.09,.10,.11]),
       _b([19200,28800,38400,48000,72000,96000,250000,350000,450000,550000,650000],[.014,.032,.055,.064,.068,.072,.076,.079,.0825,.09,.10,.11]),(8000,16000),(1144,2288),(0,0)),
 'ID':(_b([4811],[0,.053]),_b([9622],[0,.053]),(16100,32200),(0,0),(0,0)),
 'IN':(_b([],[.0295]),_b([],[.0295]),(0,0),(1000,2000),(0,0)),
 'IA':(_b([],[.038]),_b([],[.038]),(16100,32200),(0,0),(40,80)),
 'KS':(_b([23000],[.052,.0558]),_b([46000],[.052,.0558]),(3605,8240),(9160,18320),(0,0)),
 'KY':(_b([],[.035]),_b([],[.035]),(3360,6720),(0,0),(0,0)),
 'LA':(_b([],[.03]),_b([],[.03]),(12875,25750),(0,0),(0,0)),
 'MD':(_b([1000,2000,3000,100000,125000,150000,250000,500000,1000000],[.02,.03,.04,.0475,.05,.0525,.055,.0575,.0625,.065]),
       _b([1000,2000,3000,150000,175000,225000,300000,600000,1200000],[.02,.03,.04,.0475,.05,.0525,.055,.0575,.0625,.065]),(3350,6700),(3200,6400),(0,0)),
 'MA':(_b([1107750],[.05,.09]),_b([1107750],[.05,.09]),(0,0),(4400,8800),(0,0)),
 'MI':(_b([],[.0425]),_b([],[.0425]),(0,0),(5900,11800),(0,0)),
 'MS':(_b([10000],[0,.04]),_b([10000],[0,.04]),(2300,4600),(6000,12000),(0,0)),
 'MO':(_b([1348,2696,4044,5392,6740,8088,9436],[0,.02,.025,.03,.035,.04,.045,.047]),_b([1348,2696,4044,5392,6740,8088,9436],[0,.02,.025,.03,.035,.04,.045,.047]),(16100,32200),(0,0),(0,0)),
 'MT':(_b([47500],[.047,.0565]),_b([95000],[.047,.0565]),(16100,32200),(0,0),(0,0)),
 'NE':(_b([4130,24760],[.0246,.0351,.0455]),_b([8250,49530],[.0246,.0351,.0455]),(8850,17700),(0,0),(176,352)),
 'NJ':(_b([20000,35000,40000,75000,500000,1000000],[.014,.0175,.035,.05525,.0637,.0897,.1075]),
       _b([20000,50000,70000,80000,150000,500000,1000000],[.014,.0175,.0245,.035,.05525,.0637,.0897,.1075]),(0,0),(1000,2000),(0,0)),
 'NC':(_b([],[.0399]),_b([],[.0399]),(12750,25500),(0,0),(0,0)),
 'ND':(_b([49575,250400],[0,.0195,.025]),_b([82800,304850],[0,.0195,.025]),(16100,32200),(0,0),(0,0)),
 'OK':(_b([3750,4900,7200],[0,.025,.035,.045]),_b([7500,9800,14400],[0,.025,.035,.045]),(6350,12700),(1000,2000),(0,0)),
 'PA':(_b([],[.0307]),_b([],[.0307]),(0,0),(0,0),(0,0)),
 'VT':(_b([49400,119700,249700],[.0335,.066,.076,.0875]),_b([82500,199450,304000],[.0335,.066,.076,.0875]),(7650,15300),(5300,10600),(0,0)),
 'VA':(_b([3000,5000,17000],[.02,.03,.05,.0575]),_b([3000,5000,17000],[.02,.03,.05,.0575]),(8750,17500),(930,1860),(0,0)),
 'WV':(_b([10000,25000,40000,60000],[.0211,.0281,.0316,.0422,.0458]),_b([10000,25000,40000,60000],[.0211,.0281,.0316,.0422,.0458]),(0,0),(2000,4000),(0,0)),
 'DC':(_b([10000,40000,60000,250000,500000,1000000],[.04,.06,.065,.085,.0925,.0975,.1075]),_b([10000,40000,60000,250000,500000,1000000],[.04,.06,.065,.085,.0925,.0975,.1075]),(16100,32200),(0,0),(0,0)),
}
# States whose deduction/exemption/credit phases out with income on a schedule not loaded (calcsystems flags
# "shrinking/phasing out with income" without the schedule), or with other unloaded features -> NOT_SUPPORTED.
US_ST_GATED={'AL':'std deduction phase-down; federal income tax deduction','CT':'personal exemption phase-out; benefit recapture',
 'IL':'exemption phase-out','ME':'std deduction and exemption phase-out','MN':'std deduction phase-down','NM':'low/middle-income exemption phase-out',
 'OH':'exemption falls with income','RI':'std deduction and exemption phase-out','SC':'std deduction phase-down','WI':'std deduction phase-down',
 'UT':'taxpayer credit phase-out','OR':'exemption credit phase-out; federal tax subtraction'}
US_NO_TAX={'AK','FL','NV','NH','SD','TN','TX','WA','WY'}
def us_state_tax(g, st, fs='S'):
    if st in US_NO_TAX: return 0.0
    if st in US_ST_GATED or st not in US_ST: return None
    bs,bm,sd,ex,cr=US_ST[st]; i=0 if fs=='S' else 1
    return max(0.0, prog(max(0,g-sd[i]-ex[i]),(bs,bm)[i])-cr[i])
def us_state(g, st, fs='S', local=0.0):
    """Federal + FICA + state wage tax. local = mandatory local/county rate on state taxable wages (knob; MD/IN/MI/PA/OH...)."""
    t=us_state_tax(g,st,fs)
    if t is None: return NS
    return res(us_fed(g,fs)+t+local*g,us_fica(g,fs),g,dict(state=t))
def us_nra(g, state_tax=0.0, fica_exempt=False):
    """Nonresident alien wages (ECI): single brackets, NO standard deduction (IRC 63(c)(6));
    itemised deduction = state income tax paid (knob). FICA applies unless F/J/M/Q exemption (knob)."""
    tax=prog(max(0,g-state_tax),USF['S'][1])
    fica=0 if fica_exempt else us_fica(g,'S')
    return res(tax+state_tax,fica,g)
# ======================= ID 2026 =======================
ID_BR=[(60e6,.05),(250e6,.15),(500e6,.25),(5e9,.30),(None,.35)]
def idn(gm, status, deps, jkk=0.0024):
    g=gm*12; jht=0.02*g
    jp=sum(0.01*min(gm, 10547400 if m<2 else 11086300) for m in range(12))
    kes=12*0.01*min(gm,12e6)
    gb=g+12*(jkk*gm+0.003*gm+0.04*min(gm,12e6))
    ptkp=54e6+(4.5e6 if status=='K' else 0)+4.5e6*min(deps,3)
    pkp=math.floor(max(0,gb-min(0.05*gb,6e6)-jht-jp-ptkp)/1000)*1000
    return res(prog(pkp,ID_BR),jht+jp+kes,g)
def idn_nonresident(gm):
    """PPh 26: 20% of gross, final (UU PPh art. 26; DJP). Treaty relief for employment income not modelled.
    Employee social: same BPJS employee contributions as residents (assumption, knob)."""
    g=gm*12; jht=0.02*g
    jp=sum(0.01*min(gm, 10547400 if m<2 else 11086300) for m in range(12))
    kes=12*0.01*min(gm,12e6)
    return res(0.20*g,jht+jp+kes,g)
# ======================= TH 2026 =======================
TH_BR=[(150000,0),(300000,.05),(500000,.10),(750000,.15),(1e6,.20),(2e6,.25),(5e6,.30),(None,.35)]
def th(g, spouse=False, kids=0, kids2018=0):
    sso=12*0.05*min(max(g/12,1650),17500)
    allow=60000+(60000 if spouse else 0)+30000*kids+60000*kids2018
    return res(prog(max(0,g-min(0.5*g,100000)-allow-sso),TH_BR),sso,g)
# ======================= MY YA2026 =======================
MY_BR=[(5000,0),(20000,.01),(35000,.03),(50000,.06),(70000,.11),(100000,.19),(400000,.25),(600000,.26),(2e6,.28),(None,.30)]
def my(g, citizen=True, spouse_relief=False, children=0, nonresident=False):
    m=g/12; w=min(m,6000)
    if citizen: epf=0.11*g; socso=12*(0.005+0.002)*w+7*0.0075*w
    else:       epf=0.02*g; socso=7*0.0075*w
    if nonresident: return res(0.30*g,epf+socso,g)
    relief=9000+min(epf,4000)+(min(socso,350) if citizen else 0)+(4000 if spouse_relief else 0)+2000*children
    ci=max(0,g-relief); t=prog(ci,MY_BR)
    if ci<=35000: t=max(0,t-400)
    return res(t,epf+socso,g)
# ======================= NL 2026 =======================
def nl(g, ruling30=False, norm=48013):
    free=max(0,min(0.30*g, g-norm, 78600)) if ruling30 else 0
    x=g-free
    tax=prog(x,[(38883,.3575),(78426,.3756),(None,.495)])
    ahk = 3115 if x<=29736 else (max(0,3115-0.06398*(x-29736)) if x<78426 else 0)
    if x<11965: ak=0.08324*x
    elif x<25845: ak=996+0.31009*(x-11965)
    elif x<45592: ak=5300+0.01950*(x-25845)
    elif x<132920: ak=max(0,5685-0.06510*(x-45592))
    else: ak=0
    return res(max(0,tax-ahk-ak),0,g)
# ======================= NO 2026 =======================
def no(g, paye=False):
    if paye:
        return NS if g>725050 else res(0.25*g,0,g)
    it=0.22*max(0,g-min(0.46*g,95700)-114540)
    trinn=prog(g,[(226100,0),(318300,.017),(725050,.04),(980100,.137),(1467200,.168),(None,.178)])
    tr = 0 if g<=99650 else min(0.076*g, 0.25*(g-99650))
    return res(it+trinn,tr,g)
# ======================= SE 2026 =======================
PBB=59200
def se_ga(ffi):
    p=PBB
    if ffi<=0.99*p: ga=0.423*p
    elif ffi<=2.72*p: ga=0.423*p+0.2*(ffi-0.99*p)
    elif ffi<=3.11*p: ga=0.77*p
    elif ffi<=7.88*p: ga=0.77*p-0.1*(ffi-3.11*p)
    else: ga=0.293*p
    return math.ceil(ga/100)*100
def se_jsa(ai,ga,ki):
    p=PBB
    if ai<=0.91*p: b=ai
    elif ai<=3.24*p: b=0.91*p+0.3874*(ai-0.91*p)
    elif ai<=8.08*p: b=1.813*p+0.251*(ai-3.24*p)
    else: b=3.027*p
    return max(0,(b-ga)*ki)
def se(g, ki=0.3055, burial=0.00292, sink=False):
    if sink: return res(0.225*g,0,g)
    ga=se_ga(g); ti=max(0,g-ga)
    mun=ti*ki; state=0.20*max(0,ti-643000)
    pens=min(0.07*g,47100); bur=ti*burial; ps=min(0.01*ti,1184)
    red=min(mun+state, pens+se_jsa(g,ga,ki)+min(1500,max(0,0.0075*(g-40000))))
    return res(mun+state+pens+bur+ps-red,0,g)
# ======================= EE 2026 =======================
def ee(g, p2=0.02):
    ui=0.016*g; ii=p2*g
    return res(0.22*max(0,g-ui-ii-8400),ui+ii,g)
# ======================= FI 2026 =======================
FI_STATE=[(22000,.1264),(32600,.19),(40100,.3025),(52100,.3325),(None,.375)]
def fi_soc(g): return (0.073+0.0089+(0.0088 if g>=17255 else 0))*g
def fi_key(g):
    return NS if g<5800*12 else res(0.25*g,fi_soc(g),g)
def fi(g, mun=0.053, church=0.0):
    soc=fi_soc(g); puhdas=g-min(750,g); ti=max(0,puhdas-soc)
    pv=max(0,4265-0.18*max(0,ti-4265)); mti=max(0,ti-pv)
    state=prog(ti,FI_STATE); munt=mti*mun; ch=mti*church; shm=0.011*mti
    ttv=min(0.18*g,3430)-min(311,0.02*max(0,puhdas-35000))
    yle=min(160,0.025*max(0,puhdas-15150))
    return res(max(0,state+munt+ch+shm-ttv)+yle,soc,g)
# ======================= BE 2026 =======================
def be_csss_q(q):
    if q<=5836.14: return 0
    if q<=6570.54: return 0.0422*(q-5836.14)
    if q<=11211.00: return 30.99+0.011*(q-6570.54)
    if q<=12300.00: return 82.05+0.0338*(q-11211)
    if q<=18116.46: return 118.83+0.011*(q-12300)
    return 182.82
def be_bonus_m(s):   # employment bonus, white-collar, ONSS params from 1 Sep 2026
    b = 171.99 if s<=2300.62 else max(0,171.99-0.2699*(s-2300.62))
    a = 127.54 if s<=2937.93 else max(0,127.54-0.2739*(s-2937.93))
    return a,b
BE_BR=[(16720,.25),(29510,.40),(51070,.45),(None,.50)]
BE_QC_MAX=11780      # marital quotient cap, non-pensioners, income 2026 (Law 15 Jul 2026, MB 29 Jul 2026)
def be_fed_tax(ti, free=11550):
    return max(0,prog(ti,BE_BR)-prog(free,BE_BR))
def be_married_sole_earner_tax(ti, municipal=0.07, fiscal_bonus=0.0):
    """Joint taxation, partner without professional income: 30% of earner's net taxable income, capped,
    is attributed to the partner; each spouse gets the 11,550 tax-free amount. Returns household tax."""
    q=min(0.30*ti, BE_QC_MAX)
    fed=max(0,be_fed_tax(ti-q)-fiscal_bonus)+be_fed_tax(q)
    return fed*(1+municipal)
BE_CHILD_SUPP={0:0,1:2130,2:5130,3:11440,4:18510}   # income 2026 (AY 2027), cumulative totals
BE_CHILD_EXTRA=7070      # v11: per child beyond the 4th, income 2026 (mes-aides-financieres.be)
BE_SINGLE_PARENT=1980    # v11: single parent with dependent children, income 2026
def be_child_supp(n):
    return BE_CHILD_SUPP[n] if n<=4 else BE_CHILD_SUPP[4]+BE_CHILD_EXTRA*(n-4)
def be(g, municipal=0.07, expat=False, married_sole_earner=False, children=0, single_parent=False):
    if g<12*2233.61: return NS      # below RMMMG (full-time minimum wage)
    free=0.35*g if (expat and g>70000) else 0
    w=g-free; m=w/12
    a,b=be_bonus_m(m); a=12*a; b=12*b
    ss=max(0,0.1307*w-a-b)
    net=w-ss; pe=min(0.30*net,6070); ti=net-pe
    quota=11550+be_child_supp(children)+(BE_SINGLE_PARENT if (single_parent and children>0 and not married_sole_earner) else 0)
    bonus=0.3314*a+0.63*b
    if married_sole_earner:
        q=min(0.30*ti, BE_QC_MAX)                     # marital quotient to the partner without income
        fed=max(0,be_fed_tax(ti-q,quota)-bonus)+be_fed_tax(q)
    else:
        fed=max(0,be_fed_tax(ti,quota)-bonus)
    tax=fed*(1+municipal)
    csss=4*be_csss_q(g/4)          # one-income household: same scale as single, max 182.82/quarter (ONSS 2026/2)
    return res(tax,ss+csss,g)
# ======================= IT 2026 (Milan) =======================
def it_detr(r):
    if r<=15000: d=1955
    elif r<=28000: d=1910+1190*(28000-r)/13000
    elif r<=50000: d=1910*(50000-r)/22000
    else: d=0
    if 25000<r<=35000: d+=65
    return d
def it(g, impatriate=0.0, regional_flat=None, comunale=0.008, com_exempt=23000):
    # v9: no upper guard. L.199/2025 art.1 c.4 (TUIR 16-ter c.5-bis) cuts EUR440 only from 19% oneri,
    # party donations and catastrophe premiums - none exist in the employment-only scope, so no effect here.
    inps=0.0919*min(g,122295)+0.01*max(0,min(g,122295)-56224)
    r=(g-inps)*(1-impatriate)
    irpef=prog(r,[(28000,.23),(50000,.33),(None,.43)])
    cuneo_det=1000 if 20000<r<=32000 else (1000*(40000-r)/8000 if 32000<r<40000 else 0)
    cuneo_bonus = r*(0.071 if r<=8500 else 0.053 if r<=15000 else 0.048) if r<=20000 else 0
    irpef_net=max(0,irpef-it_detr(r)-cuneo_det)
    reg = r*regional_flat if regional_flat is not None else prog(r,[(15000,.0123),(28000,.0158),(50000,.0172),(None,.0173)])
    com = r*comunale if r>com_exempt else 0
    return res(irpef_net+reg+com-cuneo_bonus,inps,g)
# ======================= CH-ZH 2026 =======================
def ch_dbst_single(x):
    x=math.floor(x/100)*100
    pts=[(15200,0,0.77),(33200,138.60,0.88),(43500,229.20,2.64),(58000,612.00,2.97),(76200,1152.50,5.94),
         (82100,1502.95,6.60),(108900,3271.75,8.80),(141500,6140.55,11.00),(185100,10936.55,13.20)]
    if x<=15200: return 0.0
    if x>=794000: return 0.115*x
    base,amt,rate=max([p for p in pts if p[0]<=x],key=lambda p:p[0])
    return amt+(x-base)/100*rate
ZH_GRUND=[(7000,0),(12000,.02),(16800,.03),(24800,.04),(34500,.05),(45700,.06),(58800,.07),(76400,.08),(110400,.09),(144100,.10),(197400,.11),(266700,.12),(None,.13)]
def ch_zh(g, bvg_half=0.05, nbu=0.004, gemeinde=1.19, staat=0.95, church=0.0):
    ahv=0.053*g; alv=0.011*min(g,148200); nbuv=nbu*min(g,148200)
    coord=max(0, min(g,90720)-26460) if g>=22680 else 0
    coord=min(max(coord,3780 if g>=22680 else 0),64260)
    bvg=bvg_half*coord
    soc=ahv+alv+nbuv+bvg; netinc=g-soc
    beruf=min(max(0.03*netinc,2000),4000)
    ti_k=netinc-beruf-2900; ti_b=netinc-beruf-1800
    einfach=prog(math.floor(ti_k/100)*100, ZH_GRUND)
    kant=einfach*staat; gem=einfach*gemeinde; fed=ch_dbst_single(ti_b); kirche=einfach*church
    return res(kant+gem+kirche+24+fed,soc,g,dict(einfache=einfach,kanton=kant,gemeinde=gem,kirche=kirche,bund=fed,ti_kanton=ti_k,ti_bund=ti_b))
# --- v9: married tariffs (verified at taxable-income level; married deductions still open -> preset gated) ---
ZH_VERH=[(14100,0),(20500,.02),(28600,.03),(38400,.04),(49600,.05),(64100,.06),(96300,.07),(128700,.08),(177200,.09),(235100,.10),(298000,.11),(370600,.12),(None,.13)]
def ch_dbst_married(x):
    """Art. 36(2) DBG 2026 - full official tariff (v11; AS 2025 579, via lawbrary.ch / swissrights.ch)."""
    x=math.floor(x/100)*100
    pts=[(29700,0,1),(53400,237,2),(61300,395,3),(79100,929,4),(94900,1561,5),(108700,2251,6),(120600,2965,7),
         (130500,3658,8),(138400,4290,9),(144300,4821,10),(148300,5221,11),(150400,5452,12),(152400,5692,13)]
    if x<29700: return 0.0
    if x>=941400: return 0.115*x      # 941,400 -> 108,261 then 11.50 per 100 = 11.5% flat
    b,a,r=max([p for p in pts if p[0]<=x]); return a+(x-b)/100*r
def ch_zh_tax_on_taxable(ti, married=False, gemeinde=1.19, staat=0.95, church=0.0):
    """Canton + commune + church + federal tax for a given taxable income (same for both levels)."""
    e=prog(math.floor(ti/100)*100, ZH_VERH if married else ZH_GRUND)
    fed=ch_dbst_married(ti) if married else ch_dbst_single(ti)
    if fed is None: return NS
    return e*(staat+gemeinde+church)+fed
def ch_zh_married(g, children=0, bvg_half=0.05, nbu=0.004, gemeinde=1.19, staat=0.95, church=0.0):
    """v10: married, sole earner (no second-earner deductions), City of Zurich.
    ZH: insurance 5,800 + 1,300/child (Form 365 2026); child deduction 9,400 (taxrep 2026).
    DBST: insurance 3,700 + 700/child; married deduction 2,800; child 6,800; tax credit -263/child."""
    ahv=0.053*g; alv=0.011*min(g,148200); nbuv=nbu*min(g,148200)
    coord=max(0, min(g,90720)-26460) if g>=22680 else 0
    coord=min(max(coord,3780 if g>=22680 else 0),64260)
    soc=ahv+alv+nbuv+bvg_half*coord; netinc=g-soc
    beruf=min(max(0.03*netinc,2000),4000)
    ti_k=netinc-beruf-5800-1300*children-9400*children
    ti_b=netinc-beruf-3700-700*children-2800-6800*children
    fed=ch_dbst_married(ti_b)
    if fed is None: return NS                        # DBST married tariff not verified above 152,300
    fed=max(0,fed-263*children)
    if fed<25: fed=0
    e=prog(math.floor(max(0,ti_k)/100)*100, ZH_VERH)
    tax=e*(staat+gemeinde+church)+2*24+fed           # personal tax 24 per spouse
    return res(tax,soc,g,dict(einfache=e,bund=fed,ti_kanton=ti_k,ti_bund=ti_b))
# ======================= FR 2026 =======================
PASS_FR=48060
def fr_social(g, cadre=False):
    t1=min(g,PASS_FR); t2=max(0,min(g,8*PASS_FR)-PASS_FR)
    s = 0.069*t1 + 0.004*g + 0.0315*t1 + 0.0864*t2 + 0.0086*t1 + 0.0108*t2
    if g>PASS_FR: s += 0.0014*min(g,8*PASS_FR)
    if cadre: s += 0.00024*min(g,4*PASS_FR)
    csg_base=0.9825*min(g,4*PASS_FR)+max(0,g-4*PASS_FR)
    return s+0.068*csg_base, 0.029*csg_base
FR_BR=[(11600,0),(29579,.11),(84577,.30),(181917,.41),(None,.45)]
def fr_tax(nt, parts, base_parts):
    t=prog(nt/parts,FR_BR)*parts
    t_base=prog(nt/base_parts,FR_BR)*base_parts
    t=max(t, t_base-1807*2*(parts-base_parts))
    dec_lim,dec_k = (897,1982) if base_parts==1 else (1483,3277)
    if t<dec_k: t=max(0,t-(dec_lim-0.4525*t))
    return t
def fr(g, cadre=False, parts=1, base_parts=1, impatriate=False):
    # v11: guard moved from gross <= 4 PASS to RFR <= 250,000 (CEHR/CDHR threshold, single; applied to couples too
    # as a conservative bound). Contributions above 4 PASS (CSG base, T2 to 8 PASS, CET) are already modelled.
    ded,nonded=fr_social(g,cadre)
    ni=g-ded
    rfr=ni-min(max(0.10*ni,509),14555)            # RFR includes the exempt impatriate premium (conservative)
    if rfr>250000: return NS
    if impatriate: ni=ni*0.70     # CGI art.155 B I.1: option - 30% of (net) remuneration exempt (forfait); 8 years
    nt=ni-min(max(0.10*ni,509),14555)
    return res(fr_tax(nt,parts,base_parts),ded+nonded,g)
# ======================= ES 2026 (Madrid) =======================
ES_STATE=[(12450,.095),(20200,.12),(35200,.15),(60000,.185),(300000,.225),(None,.245)]
ES_MAD=[(13362.22,.085),(19004.63,.107),(35425.68,.128),(57320.40,.174),(None,.205)]
def es_art20(rn):
    if rn<=14852: return 7302
    if rn<=17673.52: return 7302-1.75*(rn-14852)
    if rn<19747.5: return 2364.34-1.14*(rn-17673.52)
    return 0
def es_smi_deduction(g):
    # DA 61a LIRPF (RDL 5/2026 art.28, BOE 19-2-2026), effective 1 Jan 2026; other income <= 6,500 assumed
    if g<=17094: return 590.89
    if g<20048.45: return 590.89-0.2*(g-17094)
    return 0.0
def es(g, beckham=False, children=0):
    ss=0.065*min(g,12*5101.20)
    if beckham:
        t=0.24*min(g,600000)+0.47*max(0,g-600000); return res(t,ss,g)
    rn=g-ss; base=max(0,rn-2000-es_art20(rn))
    st_min=5550+[0,2400,5100,9100][min(children,3)]
    mad_min=5956.65+[0,2575.85,5473.68,9873.68][min(children,3)]
    st=max(0,prog(base,ES_STATE)-prog(st_min,ES_STATE))
    md=max(0,prog(base,ES_MAD)-prog(mad_min,ES_MAD))
    smi=min(st+md, es_smi_deduction(g))      # capped at the cuota attributable to work income (= all of it here)
    return res(st+md-smi,ss,g,dict(state=st,madrid=md,smiDeduction=smi))
# ======================= PT 2026 (mainland, DL 212/2026 rates) =======================
PT_BR=[(8342,.122),(12587,.152),(17838,.207),(23089,.236),(29397,.306),(43090,.346),(46566,.431),(86634,.446),(None,.48)]
PT_IAS=537.13; PT_VR=max(12880,1.5*14*PT_IAS); PT_LDG=250; PT_T1=0.122; PT_LIM1=8342
PT_L=PT_VR-PT_LDG/(PT_T1*3.60)+PT_LIM1/3.60          # CIRS art.70(3); T1 as a fraction
def pt_minimo(gross, ded_esp):
    # CIRS art.70 (minimo de existencia), single titular, income predominantly cat. A
    if gross>2.2*14*PT_IAS: return 0.0               # art.70(4)(a): 16,543.60 per sujeito passivo
    if gross<=PT_VR: a=PT_VR-(ded_esp+PT_LDG/PT_T1)
    elif gross<=PT_L: a=PT_VR-2.60*(gross-PT_VR)-(ded_esp+PT_LDG/PT_T1)
    else: a=PT_L-PT_LIM1-1.35*(gross-PT_L)-ded_esp
    return min(max(0.0,a), max(0.0,gross-ded_esp))      # art.70(2)(d)
def pt_dependants(ages):
    """v11: CIRS art.78-A: 600 per dependant; 726 if aged <= 3; 900 for the 2nd and subsequent dependants aged <= 6."""
    d=0
    for i,a in enumerate(sorted(ages, reverse=True)):    # oldest = 1st dependant
        if i==0: d+=726 if a<=3 else 600
        else:    d+=900 if a<=6 else 600
    return d
def pt_expenses(col_taxable, health=0.0, education=0.0, rent=0.0, n_dep=0):
    """v11: deductions from tax for health (15%, max 1,000), education (30%, max 800), rent (15%, max 900 in 2026),
    subject to the art.78(7) global cap: none in the 1st bracket (<= 8,342), 1,000 above 80,000, linear 2,500 -> 1,000 between;
    +5% per dependant with 3+ dependants (art.78(8)). Rent is kept inside the cap (conservative; sources differ)."""
    raw=min(0.15*health,1000)+min(0.30*education,800)+min(0.15*rent,900)
    if col_taxable<=8342: return raw
    cap=1000 if col_taxable>=80000 else 2500-1500*(col_taxable-8342)/(80000-8342)
    if n_dep>=3: cap*=1+0.05*n_dep
    return min(raw,cap)
def pt(g, ifici=False, jovem_year=0, nonresident=False, deducoes_coleta=250.0, dep_ages=(), health=0.0, education=0.0, rent=0.0):
    ss=0.11*g
    if nonresident: return res(0.25*g,ss,g)
    if ifici: return res(0.20*g,ss,g)
    ex=0
    if jovem_year:
        pct=1.0 if jovem_year==1 else .75 if jovem_year<=4 else .5 if jovem_year<=7 else .25
        ex=min(pct*g,29542.15)
    gi=g-ex
    ded=max(4587.09,ss)
    mn=pt_minimo(g, ded)                              # 'rendimentos brutos' include exempt income (art.70(5)(a))
    col=max(0,gi-ded-mn)
    t=prog(col,PT_BR)+0.025*max(0,min(col,250000)-80000)+0.05*max(0,col-250000)
    t=max(0,t-deducoes_coleta-pt_dependants(list(dep_ages))-pt_expenses(col,health,education,rent,len(dep_ages)))   # general expenses (cap 250, default reached) + v11 dependants/expenses
    return res(t,ss,g,dict(minimo=mn))
# ======================= JP 2026 =======================
JP_GRADES_H=[(63000,58000),(73000,68000),(83000,78000),(93000,88000),(101000,98000),(107000,104000),(114000,110000),(122000,118000),(130000,126000),(138000,134000),(146000,142000),(155000,150000),(165000,160000),(175000,170000),(185000,180000),(195000,190000),(210000,200000),(230000,220000),(250000,240000),(270000,260000),(290000,280000),(310000,300000),(330000,320000),(350000,340000),(370000,360000),(395000,380000),(425000,410000),(455000,440000),(485000,470000),(515000,500000),(545000,530000),(575000,560000),(605000,590000),(635000,620000),(665000,650000),(695000,680000),(730000,710000),(770000,750000),(810000,790000),(855000,830000),(905000,880000),(955000,930000),(1005000,980000),(1055000,1030000),(1115000,1090000),(1175000,1150000),(1235000,1210000),(1295000,1270000),(1355000,1330000),(None,1390000)]
def jp_grade(m):
    for up,std in JP_GRADES_H:
        if up is None or m<up: return std
def jp_r(x):
    f=math.floor(x); return f+1 if x-f>0.5 else f
def jp_emp_ded(g):
    if g<=2200000: return 740000
    if g<=3600000: return 0.30*g+80000
    if g<=6600000: return 0.20*g+440000
    if g<=8500000: return 0.10*g+1100000
    return 1950000
def jp_basic(ti):
    for up,d in ((4890000,1040000),(6550000,670000),(23500000,620000),(24000000,480000),(24500000,320000),(25000000,160000)):
        if ti<=up: return d
    return 0
JP_BR=[(1950000,.05,0),(3300000,.10,97500),(6950000,.20,427500),(9000000,.23,636000),(18000000,.33,1536000),(40000000,.40,2796000),(None,.45,4796000)]
def jp_nat(ti):
    ti=math.floor(ti/1000)*1000
    for up,r,d in JP_BR:
        if up is None or ti<=up: return max(0,ti*r-d)
def jp_social(g, care=False, support_months=12):
    """Kyokai Kenpo Tokyo R8 (official table, v11): health 9.85% (11.47% with care), child-support levy 0.23%
    from April 2026 wages (support_months=12 = steady-state annualisation, default; 9 = calendar-2026 view), pension 18.3%."""
    m=g/12; sh=jp_grade(m); sp=min(max(sh,88000),650000)
    hr=0.04925+(0.0081 if care else 0)
    return 12*(jp_r(sh*hr)+jp_r(sp*0.0915)+jp_r(m*0.005))+support_months*jp_r(sh*0.00115)
def jp(g, resident_tax=True, care=False, nonresident=False):
    soc=jp_social(g,care)
    if nonresident: return res(math.floor(0.2042*g),soc,g)
    kyuyo=g-jp_emp_ded(g)
    it=math.floor(jp_nat(kyuyo-soc-jp_basic(kyuyo))*1.021/100)*100
    rt=0
    if resident_tax:
        ti=math.floor(max(0,kyuyo-soc-430000)/1000)*1000
        rt=math.floor(max(0,ti*0.06-1500)/100)*100+math.floor(max(0,ti*0.04-1000)/100)*100+5000
    return res(it+rt,soc,g,dict(incomeTax=it,residentTax=rt))
# ======================= KR 2026 =======================
def kr_ded(g):
    if g<=5e6: d=0.70*g
    elif g<=15e6: d=3.5e6+0.40*(g-5e6)
    elif g<=45e6: d=7.5e6+0.15*(g-15e6)
    elif g<=100e6: d=12e6+0.05*(g-45e6)
    else: d=14.75e6+0.02*(g-100e6)
    return min(d,20e6)
KR_BR=[(14e6,.06,0),(50e6,.15,1.26e6),(88e6,.24,5.76e6),(150e6,.35,15.44e6),(300e6,.38,19.94e6),(500e6,.40,25.94e6),(1e9,.42,35.94e6),(None,.45,65.94e6)]
def kr_tax(b):
    for up,r,d in KR_BR:
        if up is None or b<=up: return max(0,b*r-d)
def kr_credit(tax,g):
    c = 0.55*tax if tax<=1.3e6 else 715000+0.30*(tax-1.3e6)
    if g<=33e6: cap=740000
    elif g<=70e6: cap=max(660000,740000-(g-33e6)*0.008)
    elif g<=120e6: cap=max(500000,660000-(g-70e6)*0.5)
    else: cap=max(200000,500000-(g-120e6)*0.5)
    return min(c,cap)
def kr_social(g, nps_cap_h1=6.37e6, nps_cap_h2=6.59e6):
    m=g/12
    nps=6*0.0475*min(m,nps_cap_h1)+6*0.0475*min(m,nps_cap_h2)
    hi=0.03595*g
    return nps+hi+hi*0.1314+0.009*g
def kr(g, flat=False):
    soc=kr_social(g)
    if flat: t=0.19*g
    else:
        t=kr_tax(max(0,g-kr_ded(g)-1.5e6-soc)); t=max(0,t-kr_credit(t,g))
    return res(t*1.1,soc,g)
# ======================= CA-ON 2026 =======================
FED_CA=[(58523,.14),(117045,.205),(181440,.26),(258482,.29),(None,.33)]
ON_BR=[(53891,.0505),(107785,.0915),(150000,.1116),(220000,.1216),(None,.1316)]
def ca_ohp(ti):
    if ti<=20000: return 0
    if ti<=36000: return min(300,0.06*(ti-20000))
    if ti<=48000: return min(450,300+0.06*(ti-36000))
    if ti<=72000: return min(600,450+0.25*(ti-48000))
    if ti<=200000: return min(750,600+0.25*(ti-72000))
    return min(900,750+0.25*(ti-200000))
def ca_fed_bpa(ti):
    return 16452 if ti<=181440 else max(14829,16452-(ti-181440)*(16452-14829)/(258482-181440))
def ca_cpp(g):
    cpp=0.0595*max(0,min(g,74600)-3500); cpp2=0.04*max(0,min(g,85000)-74600); ei=0.0163*min(g,68900)
    cpp_enh=cpp/5.95; cpp_base=cpp-cpp_enh
    return cpp,cpp2,ei,cpp_enh,cpp_base
def ca_fed(g, ti, cpp_base, ei, extra_credit_base=0.0):
    return max(0,prog(ti,FED_CA)-0.14*(ca_fed_bpa(ti)+min(1501,g)+cpp_base+ei+extra_credit_base))
def ca_on(g, children=0):
    # v9: guard removed - Ontario Tax Reduction and LIFT credit now modelled
    cpp,cpp2,ei,cpp_enh,cpp_base=ca_cpp(g)
    ti=g-cpp_enh-cpp2
    fed=ca_fed(g,ti,cpp_base,ei)
    on=max(0,prog(ti,ON_BR)-0.0505*(12989+cpp_base+ei))
    on=on+0.20*max(0,on-5818)+0.36*max(0,on-7446)
    otr=min(on, max(0, 2*(300+554*children)-on))        # ON428: 2 x (basic 300 + 554/child) - ON tax
    on-=otr
    lift=max(0, min(0.0505*g,875)-0.05*max(0,ti-32500))  # LIFT (single: individual net income test)
    on=max(0,on-lift)
    prov=on+ca_ohp(ti)
    return res(fed+prov,cpp+cpp2+ei,g,dict(federal=fed,ontario=prov,otr=otr,lift=lift))
BC_BR=[(50363,.056),(100728,.077),(115648,.105),(140430,.1229),(190405,.147),(265545,.168),(None,.205)]
def ca_bc(g):
    cpp,cpp2,ei,cpp_enh,cpp_base=ca_cpp(g)
    ti=g-cpp_enh-cpp2
    fed=ca_fed(g,ti,cpp_base,ei)
    bc=max(0,prog(ti,BC_BR)-0.056*(13216+cpp_base+ei))
    red=max(0,690-0.0356*max(0,ti-25570))              # BC tax reduction credit 2026
    bc=max(0,bc-red)
    return res(fed+bc,cpp+cpp2+ei,g,dict(federal=fed,bc=bc,bcReduction=red))
AB_BR=[(61200,.08),(154259,.10),(185111,.12),(246813,.13),(370220,.14),(None,.15)]
def ca_ab(g):
    cpp,cpp2,ei,cpp_enh,cpp_base=ca_cpp(g)
    ti=g-cpp_enh-cpp2
    fed=ca_fed(g,ti,cpp_base,ei)
    ab=max(0,prog(ti,AB_BR)-0.08*(22769+cpp_base+ei))
    return res(fed+ab,cpp+cpp2+ei,g,dict(federal=fed,ab=ab))
QC_BR=[(54345,.14),(108680,.19),(132245,.24),(None,.2575)]
def ca_qc(g):
    qpp=0.063*max(0,min(g,74600)-3500); qpp2=0.04*max(0,min(g,85000)-74600)
    ei=0.013*min(g,68900); qpip=0.0043*min(g,103000)
    qpp_enh=qpp*1.0/6.3; qpp_base=qpp-qpp_enh            # 5.3% base + 1.0% first additional
    ti=g-qpp_enh-qpp2
    fed=ca_fed(g,ti,qpp_base,ei,extra_credit_base=qpip)*(1-0.165)   # Quebec abatement 16.5%
    ti_q=ti-min(0.06*g,1450)                             # deduction for workers 2026
    qc=max(0,prog(ti_q,QC_BR)-0.14*18952)                # QC BPA already accounts for QPP/QPIP/EI
    return res(fed+qc,qpp+qpp2+ei+qpip,g,dict(federal=fed,quebec=qc))
# ======================= HK YA2026/27 =======================
def hk(g, mpf=True, married=False, children=0):
    m=g/12
    mpf_emp=12*(0 if (not mpf or m<7100) else 0.05*min(m,30000))
    net=g-min(mpf_emp,18000)
    allow=(290000 if married else 145000)+140000*children
    progt=prog(max(0,net-allow),[(50000,.02),(100000,.06),(150000,.10),(200000,.14),(None,.17)])
    return res(min(progt,0.15*min(net,5e6)+0.16*max(0,net-5e6)),mpf_emp,g)
# ======================= CN-SH 2026 =======================
CN_BR=[(36000,.03,0),(144000,.10,2520),(300000,.20,16920),(420000,.25,31920),(660000,.30,52920),(960000,.35,85920),(None,.45,181920)]
def cn_iit(t):
    for up,r,d in CN_BR:
        if up is None or t<=up: return max(0,t*r-d)
def cn_sh(g, hf=0.07, expat_allow=0.0, special=0.0):
    m=g/12; soc=0
    for mo in range(12):
        lo,hi=(7460,37302) if mo<6 else (7546,37731)
        b=min(max(m,lo),hi); soc+=b*(0.08+0.02+0.005)+min(max(m,2740),hi)*hf
    soc+= 0
    t=cn_iit(max(0,g-60000-soc-expat_allow-special))
    return res(t,soc,g)
# ======================= TW 2026 =======================
TW_BR=[(610000,.05,0),(1380000,.12,42700),(2770000,.20,153100),(5190000,.30,430100),(None,.40,949100)]
def tw_tax(nti):
    for up,r,d in TW_BR:
        if up is None or nti<=up: return max(0,nti*r-d)
def tw(g, married=False, minor_children=0, nonresident=False, gold_card=False):
    m=g/12
    li=12*0.125*0.20*min(m,45800); nhi=12*0.0517*0.30*min(m,219500)
    if nonresident: return res(g*(0.06 if m<=44250 else 0.18),li+nhi,g)
    ex=101000*(2 if married else 1)+151500*minor_children
    std=272000 if married else 136000
    sal=g-min(g,227000)                               # salary income after the special deduction
    excl=0.5*max(0,sal-3e6) if gold_card else 0       # Art.22 Foreign Professionals Act: 50% above NT$3M, 5 yrs
    nti=max(0,sal-excl-ex-std)
    return res(tw_tax(nti),li+nhi,g)
# ======================= Gulf =======================
def gulf(g, rate, capm=None):
    return res(0, rate*(min(g/12,capm)*12 if capm else g), g)
def kw_national(g):
    m=g/12; return res(0,12*(0.08*min(m,2750)+0.025*min(m,1500)),g)
def sa_new_entrant_2026(g):
    m=min(g/12,45000); return res(0,6*0.1025*m+6*0.1075*m,g)

CASES={
 'AU':[(p,g,lambda g,p=p:au(g,p)) for g in (60000,120000,300000) for p in ('pr','temp','foreign','whm')],
 'SG':[(p,g,lambda g,r=r:sg(g,r)) for g in (60000,120000,300000) for p,r in (('ep',0),('citizen55',.20),('pr1',.05),('pr2',.15))],
 'UK':[(p,g,lambda g,p=p:uk(g,p)) for g in (40000,80000,150000) for p in ('rUK','SCO')],
 'DE':[(n,g,f) for g in (50000,85000,150000) for n,f in (('I',lambda g:de(g)),('III',lambda g:de(g,'III',childless=False)),('I_church9',lambda g:de(g,'I',0.09)))],
 'US-TX':[(p,g,lambda g,p=p:us(g,p)) for g in (80000,180000,500000) for p in ('S','MFJ')],
 'US-CA':[(n,g,f) for g in (80000,180000,500000) for n,f in (('single',lambda g:us_ca(g)),('MFJ',lambda g:us_ca(g,'MFJ')))],
 'US-NY':[(n,g,f) for g in (60000,100000,180000) for n,f in (('NYS_single',lambda g:us_ny(g)),('NYC_single',lambda g:us_ny(g,nyc=True)))],
 'ID (gross/month)':[(n,gm,f) for gm in (15e6,40e6,100e6) for n,f in (('TK0',lambda gm:idn(gm,'TK',0)),('K2',lambda gm:idn(gm,'K',2)))],
 'TH':[(n,g,f) for g in (600000,1200000,3600000) for n,f in (('single',lambda g:th(g)),('married2kids',lambda g:th(g,True,2)))],
 'MY':[(n,g,f) for g in (42000,120000,360000) for n,f in (('citizen',lambda g:my(g)),('expat_resident',lambda g:my(g,False)),('expat_nonresident',lambda g:my(g,False,nonresident=True)))],
 'NL (gross incl. holiday pay)':[(n,g,f) for g in (54000,86400,162000) for n,f in (('standard',lambda g:nl(g)),('ruling30',lambda g:nl(g,True)))],
 'NO':[(n,g,f) for g in (600000,700000,1500000) for n,f in (('resident',lambda g:no(g)),('PAYE25',lambda g:no(g,True)))],
 'SE':[(n,g,f) for g in (420000,600000,900000) for n,f in (('Stockholm30.55',lambda g:se(g)),('SINK',lambda g:se(g,sink=True)))],
 'EE':[(n,g,f) for g in (24000,48000,96000) for n,f in (('pillarII_2pct',lambda g:ee(g)),('pillarII_off',lambda g:ee(g,0)))],
 'FI':[(n,g,f) for g in (42000,72000,120000) for n,f in (('Helsinki5.30',lambda g:fi(g)),('Helsinki_church1',lambda g:fi(g,church=0.01)),('keyEmployee',fi_key))],
 'BE':[(n,g,f) for g in (30000,60000,90000,150000) for n,f in (('single_7pct',lambda g:be(g)),('expat35',lambda g:be(g,expat=True)),('married_sole_earner',lambda g:be(g,married_sole_earner=True)))],
 'IT':[(n,g,f) for g in (35000,60000,120000,250000) for n,f in (('Milan',lambda g:it(g)),('impatriate50',lambda g:it(g,0.5)),('impatriate60_child',lambda g:it(g,0.6)))],
 'CH-ZH (city, single, age 35-44)':[(n,g,f) for g in (80000,120000,200000) for n,f in (('B_permit_single',lambda g:ch_zh(g)),('B_permit_single_church10',lambda g:ch_zh(g,church=0.10)),('married',ch_zh_married))],
 'FR':[(n,g,f) for g in (36000,60000,120000) for n,f in (('single_noncadre',lambda g:fr(g)),('single_cadre',lambda g:fr(g,True)),('married2kids_cadre',lambda g:fr(g,True,3,2)))],
 'ES (Madrid)':[(n,g,f) for g in (17094,19000,30000,40000,80000) for n,f in (('resident_single',lambda g:es(g)),('resident_2kids',lambda g:es(g,children=2)),('beckham',lambda g:es(g,True)))],
 'PT':[(n,g,f) for g in (12880,15000,18000,30000,60000,120000) for n,f in (('resident',lambda g:pt(g)),('IRSJovem_y3',lambda g:pt(g,jovem_year=3)),('IFICI',lambda g:pt(g,True)),('nonresident',lambda g:pt(g,nonresident=True)))],
 'JP (Tokyo, <40)':[(n,g,f) for g in (5e6,8e6,15e6) for n,f in (('year2plus',lambda g:jp(g)),('year1_noResidentTax',lambda g:jp(g,False)),('nonresident',lambda g:jp(g,nonresident=True)))],
 'KR':[(n,g,f) for g in (50e6,100e6,200e6) for n,f in (('progressive',lambda g:kr(g)),('flat19',lambda g:kr(g,True)))],
 'CA-ON':[('single',g,ca_on) for g in (25000,40000,60000,100000,200000)],
 'CA-BC':[('single',g,ca_bc) for g in (30000,60000,100000,200000)],
 'CA-AB':[('single',g,ca_ab) for g in (30000,60000,100000,200000)],
 'CA-QC':[('single',g,ca_qc) for g in (30000,60000,100000,200000)],
 'HK':[(n,g,f) for g in (360000,720000,1500000) for n,f in (('single_MPF',lambda g:hk(g)),('single_MPFexempt',lambda g:hk(g,False)),('married2kids_MPF',lambda g:hk(g,True,True,2)))],
 'CN-SH':[(n,g,f) for g in (240000,480000,960000) for n,f in (('local_hf7',lambda g:cn_sh(g)),('expat_allow120k',lambda g:cn_sh(g,expat_allow=120000)))],
 'TW':[(n,g,f) for g in (1200000,2400000,6000000) for n,f in (('resident_single',lambda g:tw(g)),('resident_married2kids',lambda g:tw(g,True,2)),('nonresident',lambda g:tw(g,nonresident=True)))],
 'Gulf':[(n,g,f) for g in (240000,600000) for n,f in (('AE_expat',lambda g:gulf(g,0)),('AE_national',lambda g:gulf(g,.11,70000)),('QA_national',lambda g:gulf(g,.07,100000)),('SA_national_legacy',lambda g:gulf(g,.0975,45000)),('SA_national_new_2026',sa_new_entrant_2026),('BH_expat',lambda g:gulf(g,.01)),('BH_national',lambda g:gulf(g,.08)),('OM_national',lambda g:gulf(g,.08,3000)))]+[('KW_national',g,kw_national) for g in (12000,36000)],
}
# ---------------- v10 case additions ----------------
CASES['US-NY']=[(n,g,f) for g in (60000,100000,150000,180000) for n,f in (
    ('NYS_single',lambda g:us_ny(g)),('NYC_single',lambda g:us_ny(g,nyc=True)),
    ('NYS_MFJ',lambda g:us_ny(g,'MFJ')),('NYC_MFJ',lambda g:us_ny(g,'MFJ',nyc=True)))]+[
    (n,250000,f) for n,f in (('NYS_single',lambda g:us_ny(g)),('NYS_MFJ',lambda g:us_ny(g,'MFJ')))]
CASES['US-TX NRA']=[(n,g,f) for g in (80000,180000) for n,f in (('H1B_NRA',lambda g:us_nra(g)),('F1_NRA_ficaExempt',lambda g:us_nra(g,fica_exempt=True)))]
CASES['ID (gross/month)']+=[('nonresident',gm,idn_nonresident) for gm in (15e6,40e6,100e6)]
CASES['BE']+=[(n,g,f) for g in (60000,90000) for n,f in (('single_2kids',lambda g:be(g,children=2)),('married_sole_earner_2kids',lambda g:be(g,married_sole_earner=True,children=2)))]
CASES['CH-ZH (city, single, age 35-44)']+=[('married_2kids',g,lambda g:ch_zh_married(g,children=2)) for g in (80000,120000,200000)]
CASES['FR']+=[('single_cadre_impatriate30',g,lambda g:fr(g,True,impatriate=True)) for g in (60000,120000)]
CASES['TW']+=[('resident_single_goldcard',g,lambda g:tw(g,gold_card=True)) for g in (2400000,6000000)]
CASES['Gulf']=[(n,g,f) for g in (240000,600000) for n,f in (('AE_expat',lambda g:gulf(g,0)),('AE_national',lambda g:gulf(g,.11,70000)),('QA_national',lambda g:gulf(g,.07,100000)),('SA_national_legacy',lambda g:gulf(g,.0975,45000)),('SA_national_new_2026',sa_new_entrant_2026),('BH_expat',lambda g:gulf(g,.01,4000)),('BH_national',lambda g:gulf(g,.08,4000)),('OM_national',lambda g:gulf(g,.08,3000)))]+[('KW_national',g,kw_national) for g in (12000,36000)]
# ---------------- v11 case additions ----------------
CASES['US-NY']+=[(n,g,f) for g in (600000,2500000) for n,f in (('NYS_single',lambda g:us_ny(g)),('NYS_MFJ',lambda g:us_ny(g,'MFJ')))]
CASES['US-states (v11)']=[(f'{st}_{fs}',g,(lambda g,st=st,fs=fs:us_state(g,st,fs))) for st in sorted(US_ST) for fs in ('S','MFJ') for g in (80000,180000)]+[
    (f'{st}_S_gated',80000,(lambda g,st=st:us_state(g,st))) for st in ('IL','OH','UT')]
CASES['BE']+=[('married_sole_earner_5kids',90000,lambda g:be(g,married_sole_earner=True,children=5)),
              ('single_parent_2kids',60000,lambda g:be(g,children=2,single_parent=True))]
CASES['FR']+=[('single_cadre',g,lambda g:fr(g,True)) for g in (250000,320000)]
CASES['PT']=CASES.get('PT',[])+[('resident_2deps_8y_2y',g,lambda g:pt(g,dep_ages=(8,2))) for g in (30000,60000)]+[
    ('resident_health2000_edu1000',40000,lambda g:pt(g,health=2000,education=1000))]
if __name__=='__main__':
    out={}
    for c,rows in CASES.items():
        for n,g,f in rows: out[f'{c}|{n}|{int(g)}']=f(g)
    json.dump(out,open('golden.json','w'),indent=1)
    print(len(out),'cases')
