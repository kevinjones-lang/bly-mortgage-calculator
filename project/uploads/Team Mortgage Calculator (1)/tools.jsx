/* tools.jsx — Buyer Cash-to-Close + Seller Net Sheet (branded).
   Loaded before app.jsx; renders use window.BlyShared (defined in app.jsx) at runtime. */
(function () {
  const { useState, useMemo } = React;
  const M = window.Mortgage;
  const { Field, MoneyInput, NumInput, CostRow } = window.BlyUI;
  const money = M.money;

  function MiniLoan({ deal, set }) {
    const cfg = M.PRODUCTS[deal.product];
    return (
      <div className="block">
        <div className="section-label">The <b>purchase</b></div>
        <Field label="Purchase price">
          <MoneyInput value={deal.homePrice} onChange={(v) => set({ homePrice: v })} placeholder="325,000" />
        </Field>
        <Field label="Loan type">
          <div className="seg cols-4">
            {Object.values(M.PRODUCTS).map((p) => (
              <button key={p.key} className={"seg-btn" + (deal.product === p.key ? " active" : "")}
                onClick={() => set({ product: p.key, downPct: M.PRODUCTS[p.key].downOptions.includes(deal.downPct) ? deal.downPct : M.PRODUCTS[p.key].defaultDown })}>
                {p.name}
              </button>
            ))}
          </div>
        </Field>
        <div className="two-col">
          <Field label="Down payment">
            <div className={"seg cols-" + (cfg.downOptions.length >= 4 ? 4 : cfg.downOptions.length)}>
              {cfg.downOptions.map((d) => (
                <button key={d} className={"seg-btn" + (deal.downPct === d ? " active" : "")} onClick={() => set({ downPct: d })}>{d}%</button>
              ))}
            </div>
          </Field>
          <Field label="Interest rate">
            <NumInput value={deal.rate} onChange={(v) => set({ rate: v })} suffix="%" placeholder="6.25" />
          </Field>
        </div>
      </div>
    );
  }

  /* ===================== BUYER CASH-TO-CLOSE ===================== */
  function BuyerTool({ deal, set, ai }) {
    const cfg = M.PRODUCTS[deal.product];
    const [f, setF] = useState({
      originationPct: "1", appraisal: "550", creditInspection: "475", escrowFee: "400",
      survey: "525", recording: "175", prepaidInterestDays: "15", taxEscrowMonths: "3", insEscrowMonths: "3",
      sellerConcessions: "0"
    });
    const setFee = (patch) => setF((p) => ({ ...p, ...patch }));

    // Typical seller-concession cap by program (% of price).
    const CONCESSION_CAP = { conventional: deal.downPct >= 10 ? 6 : 3, fha: 6, va: 4, usda: 6 };
    const capPct = CONCESSION_CAP[deal.product] || 3;
    const capDollars = M.num(deal.homePrice) * capPct / 100;

    const r = useMemo(() => M.buyerClosing({
      homePrice: deal.homePrice, downPct: deal.downPct, rate: deal.rate,
      taxRatePct: deal.taxRate, insuranceAnnual: deal.insurance,
      originationPct: f.originationPct, appraisal: f.appraisal, creditInspection: f.creditInspection,
      escrowFee: f.escrowFee, survey: f.survey, recording: f.recording,
      prepaidInterestDays: f.prepaidInterestDays, taxEscrowMonths: f.taxEscrowMonths, insEscrowMonths: f.insEscrowMonths,
      sellerConcessions: f.sellerConcessions
    }), [deal, f]);

    return (
      <div className="grid">
        <section className="panel panel-pad">
          <MiniLoan deal={deal} set={set} />
          <div className="block">
            <div className="section-label">Local <b>tax &amp; insurance</b></div>
            <window.BlyShared.AddressEstimator deal={deal} ai={ai} />
            <div className="two-col">
              <Field label="Property tax rate"><NumInput value={deal.taxRate} onChange={(v) => set({ taxRate: v })} suffix="% / yr" /></Field>
              <Field label="Home insurance"><MoneyInput value={deal.insurance} onChange={(v) => set({ insurance: v })} /></Field>
            </div>
          </div>
          <div className="block">
            <div className="section-label">Closing-cost <b>assumptions</b></div>
            <div className="two-col">
              <Field label="Loan origination"><NumInput value={f.originationPct} onChange={(v) => setFee({ originationPct: v })} suffix="% loan" /></Field>
              <Field label="Appraisal"><MoneyInput value={f.appraisal} onChange={(v) => setFee({ appraisal: v })} /></Field>
              <Field label="Credit + inspection"><MoneyInput value={f.creditInspection} onChange={(v) => setFee({ creditInspection: v })} /></Field>
              <Field label="Escrow / closing fee"><MoneyInput value={f.escrowFee} onChange={(v) => setFee({ escrowFee: v })} /></Field>
              <Field label="Survey"><MoneyInput value={f.survey} onChange={(v) => setFee({ survey: v })} /></Field>
              <Field label="Recording & gov."><MoneyInput value={f.recording} onChange={(v) => setFee({ recording: v })} /></Field>
            </div>
            <div className="section-label" style={{ marginTop: 18 }}>Prepaids &amp; <b>escrow reserves</b></div>
            <div className="two-col">
              <Field label="Prepaid interest"><NumInput value={f.prepaidInterestDays} onChange={(v) => setFee({ prepaidInterestDays: v })} suffix="days" /></Field>
              <Field label="Tax reserve"><NumInput value={f.taxEscrowMonths} onChange={(v) => setFee({ taxEscrowMonths: v })} suffix="months" /></Field>
              <Field label="Insurance reserve"><NumInput value={f.insEscrowMonths} onChange={(v) => setFee({ insEscrowMonths: v })} suffix="months" /></Field>
            </div>
          </div>
          <div className="block">
            <div className="section-label">Seller <b>concessions</b></div>
            <Field label="Credit toward buyer costs" hint={cfg.name + " cap ≈ " + capPct + "% (" + money(capDollars) + ")"}>
              <MoneyInput value={f.sellerConcessions} onChange={(v) => setFee({ sellerConcessions: v })} placeholder="0" />
            </Field>
            <div className="seg cols-3" style={{ marginTop: 4 }}>
              {[0, Math.round(capDollars / 2), Math.round(capDollars)].map((amt, i) => (
                <button key={i} className={"seg-btn" + (M.num(f.sellerConcessions) === amt ? " active" : "")}
                  onClick={() => setFee({ sellerConcessions: String(amt) })}>{i === 0 ? "None" : (i === 1 ? "Half cap" : "Max cap")}<small>{money(amt)}</small></button>
              ))}
            </div>
            <div className="buyer-note">Negotiated credits from the seller offset your closing costs and prepaids — they can’t reduce the down payment, and lenders cap them at a percentage of the price by loan type.</div>
          </div>
        </section>

        <section className="results">
          <div className="panel" style={{ overflow: "hidden" }}>
            <div className="result-hero">
              <div className="rh-inner">
                <div className="rh-label">Estimated cash to close</div>
                <div className="rh-amount">{money(r.cashToClose)}</div>
                <div className="rh-sub">Down payment + closing costs + <em>prepaids</em></div>
                <div className="rh-chips">
                  <div className="rh-chip">Loan amount<b>{money(r.loan)}</b></div>
                  <div className="rh-chip">Down ({r.downPct}%)<b>{money(r.down)}</b></div>
                  {r.sellerConcessions > 0
                    ? <div className="rh-chip">Seller credit<b>−{money(r.sellerConcessions)}</b></div>
                    : <div className="rh-chip">Costs + prepaids<b>{money(r.closingCosts + r.prepaids)}</b></div>}
                </div>
              </div>
            </div>
            <div className="panel-pad">
              <div className="cost-group">
                <div className="cost-head"><span>Down payment</span><span>{money(r.down)}</span></div>
              </div>
              <div className="cost-group">
                <div className="cost-head"><span>Loan &amp; lender costs</span><span>{money(r.loanCosts.reduce((s, x) => s + x.value, 0))}</span></div>
                {r.loanCosts.map((c, i) => <CostRow key={i} {...c} />)}
              </div>
              <div className="cost-group">
                <div className="cost-head"><span>Title &amp; government</span><span>{money(r.titleGov.reduce((s, x) => s + x.value, 0))}</span></div>
                {r.titleGov.map((c, i) => <CostRow key={i} {...c} />)}
              </div>
              <div className="cost-group">
                <div className="cost-head"><span>Prepaids &amp; escrow</span><span>{money(r.prepaids)}</span></div>
                {r.prepaidItems.map((c, i) => <CostRow key={i} {...c} />)}
              </div>
              {r.sellerConcessions > 0 && (
                <div className="cost-group">
                  <div className="cost-head"><span>Seller concessions</span><span className="credit">−{money(r.sellerConcessions)}</span></div>
                  <div className="cost-row">
                    <span className="cost-name">Credit toward closing costs &amp; prepaids
                      <small>{r.concessionsCapped ? "capped at program max" : "negotiated with seller"}</small>
                    </span>
                    <span className="cost-val credit">−{money(r.sellerConcessions)}</span>
                  </div>
                </div>
              )}
              <div className="grand-total">
                <span>Estimated cash to close</span><b>{money(r.cashToClose)}</b>
              </div>
              <window.BlyShared.Disclaimer />
            </div>
          </div>
          <window.BlyShared.ContactBar cta="Talk to a Lender" sub="Want exact numbers? We'll connect you with a trusted local lender." />
        </section>
      </div>
    );
  }

  /* ===================== SELLER NET SHEET ===================== */
  function SellerTool({ deal, set }) {
    const [s, setS] = useState({
      salePrice: deal.homePrice, payoff: 240000, commissionPct: "6", escrowFee: "350",
      survey: "525", hoaTransfer: "375", warranty: "550", docPrep: "250", recording: "50",
      concessions: "0", monthsOwnedInYear: "6", payTitle: true
    });
    const setSeller = (patch) => setS((p) => ({ ...p, ...patch }));

    const r = useMemo(() => M.sellerNet({
      salePrice: s.salePrice, payoff: s.payoff, commissionPct: s.commissionPct, taxRatePct: deal.taxRate,
      monthsOwnedInYear: s.monthsOwnedInYear, escrowFee: s.escrowFee, survey: s.survey,
      hoaTransfer: s.hoaTransfer, warranty: s.warranty, docPrep: s.docPrep, recording: s.recording,
      concessions: s.concessions, payTitle: s.payTitle, other: 0
    }), [s, deal.taxRate]);

    return (
      <div className="grid">
        <section className="panel panel-pad">
          <div className="block">
            <div className="section-label">The <b>sale</b></div>
            <Field label="Sale price"><MoneyInput value={s.salePrice} onChange={(v) => setSeller({ salePrice: v })} placeholder="325,000" /></Field>
            <Field label="Mortgage payoff" hint="Remaining loan balance"><MoneyInput value={s.payoff} onChange={(v) => setSeller({ payoff: v })} placeholder="0" /></Field>
            <div className="two-col">
              <Field label="Agent commission"><NumInput value={s.commissionPct} onChange={(v) => setSeller({ commissionPct: v })} suffix="%" placeholder="6" /></Field>
              <Field label="Tax proration"><NumInput value={s.monthsOwnedInYear} onChange={(v) => setSeller({ monthsOwnedInYear: v })} suffix="mo owned" /></Field>
            </div>
          </div>
          <div className="block">
            <div className="section-label">Estimated <b>seller costs</b></div>
            <Field>
              <div className={"toggle-row" + (s.payTitle ? " on" : "")} onClick={() => setSeller({ payTitle: !s.payTitle })}>
                <div className="tg"></div>
                <div className="tg-label">Seller pays owner's title policy<small>Customary for the seller in Texas</small></div>
              </div>
            </Field>
            <div className="two-col">
              <Field label="Escrow / closing fee"><MoneyInput value={s.escrowFee} onChange={(v) => setSeller({ escrowFee: v })} /></Field>
              <Field label="Survey"><MoneyInput value={s.survey} onChange={(v) => setSeller({ survey: v })} /></Field>
              <Field label="HOA transfer"><MoneyInput value={s.hoaTransfer} onChange={(v) => setSeller({ hoaTransfer: v })} /></Field>
              <Field label="Home warranty"><MoneyInput value={s.warranty} onChange={(v) => setSeller({ warranty: v })} /></Field>
              <Field label="Doc prep / attorney"><MoneyInput value={s.docPrep} onChange={(v) => setSeller({ docPrep: v })} /></Field>
              <Field label="Recording & misc"><MoneyInput value={s.recording} onChange={(v) => setSeller({ recording: v })} /></Field>
            </div>
            <Field label="Seller concessions" hint="Credits paid to buyer"><MoneyInput value={s.concessions} onChange={(v) => setSeller({ concessions: v })} /></Field>
          </div>
        </section>

        <section className="results">
          <div className="panel" style={{ overflow: "hidden" }}>
            <div className="result-hero">
              <div className="rh-inner">
                <div className="rh-label">Estimated net proceeds</div>
                <div className="rh-amount">{money(r.net)}</div>
                <div className="rh-sub">After payoff, commission &amp; <em>closing costs</em></div>
                <div className="rh-chips">
                  <div className="rh-chip">Sale price<b>{money(r.price)}</b></div>
                  <div className="rh-chip">Total costs<b>{money(r.totalCosts)}</b></div>
                  <div className="rh-chip">Net of sale<b>{M.pct(r.netPct * 100, 1)}</b></div>
                </div>
              </div>
            </div>
            <div className="panel-pad">
              <div className="cost-group">
                <div className="cost-head"><span>Sale price</span><span>{money(r.price)}</span></div>
                <CostRow label="Less: mortgage payoff" sub="remaining balance" value={r.payoff} />
              </div>
              <div className="cost-group">
                <div className="cost-head"><span>Selling costs</span><span>{money(r.totalCosts)}</span></div>
                {r.items.map((c, i) => c.value > 0 ? <CostRow key={i} {...c} /> : null)}
              </div>
              <div className="grand-total green">
                <span>Estimated net to seller</span><b>{money(r.net)}</b>
              </div>
              <window.BlyShared.Disclaimer />
            </div>
          </div>
          <window.BlyShared.ContactBar cta="Get a Home Value" sub="Curious what your home is worth today? We'll prepare a free market analysis." />
        </section>
      </div>
    );
  }

  /* ===================== RENT vs BUY ===================== */
  function RentBuyTool({ deal, set, ai }) {
    const [rb, setRb] = useState({
      monthlyRent: 2200, renterInsMonthly: "15", stayYears: "7", appreciationPct: "4",
      savingsRatePct: "6", inflationPct: "3", incomeTaxPct: "22", maintenanceMonthly: "150",
      pointsPct: "0", originationPct: "1", pmiAnnualPct: "0.5", commissionPct: "6"
    });
    const setF = (patch) => setRb((p) => ({ ...p, ...patch }));
    const down = deal.homePrice * deal.downPct / 100;

    const r = useMemo(() => M.rentVsBuy({
      homePrice: deal.homePrice, downPayment: down, termYears: deal.termYears, rate: deal.rate,
      taxRatePct: deal.taxRate, insuranceAnnual: deal.insurance, hoaMonthly: deal.hoa,
      monthlyRent: rb.monthlyRent, renterInsMonthly: rb.renterInsMonthly,
      inflationPct: rb.inflationPct, pointsPct: rb.pointsPct, originationPct: rb.originationPct,
      pmiAnnualPct: rb.pmiAnnualPct, maintenanceMonthly: rb.maintenanceMonthly,
      incomeTaxPct: rb.incomeTaxPct, savingsRatePct: rb.savingsRatePct,
      appreciationPct: rb.appreciationPct, stayYears: rb.stayYears, commissionPct: rb.commissionPct
    }), [deal, rb, down]);

    const verdict = r.buyWins
      ? { word: "Buying", color: "var(--seg-savings)", amt: r.diff }
      : { word: "Renting", color: "var(--seg-tax)", amt: -r.diff };

    return (
      <div className="grid">
        <section className="panel panel-pad">
          <MiniLoan deal={deal} set={set} />
          <div className="block">
            <div className="section-label">If you <b>rent instead</b></div>
            <div className="two-col">
              <Field label="Monthly rent"><MoneyInput value={rb.monthlyRent} onChange={(v) => setF({ monthlyRent: v })} placeholder="2,200" /></Field>
              <Field label="Renter's insurance"><MoneyInput value={rb.renterInsMonthly} onChange={(v) => setF({ renterInsMonthly: v })} placeholder="15" /></Field>
            </div>
          </div>
          <div className="block">
            <div className="section-label">Local <b>tax &amp; insurance</b></div>
            <window.BlyShared.AddressEstimator deal={deal} ai={ai} />
            <div className="two-col">
              <Field label="Property tax rate"><NumInput value={deal.taxRate} onChange={(v) => set({ taxRate: v })} suffix="% / yr" /></Field>
              <Field label="Home insurance"><MoneyInput value={deal.insurance} onChange={(v) => set({ insurance: v })} /></Field>
            </div>
          </div>
          <div className="block">
            <div className="section-label">Your <b>assumptions</b></div>
            <div className="two-col">
              <Field label="Years in the home"><NumInput value={rb.stayYears} onChange={(v) => setF({ stayYears: v })} suffix="yrs" /></Field>
              <Field label="Home appreciation"><NumInput value={rb.appreciationPct} onChange={(v) => setF({ appreciationPct: v })} suffix="% / yr" /></Field>
              <Field label="Investment return" hint="If you invested the down payment"><NumInput value={rb.savingsRatePct} onChange={(v) => setF({ savingsRatePct: v })} suffix="% / yr" /></Field>
              <Field label="Rent inflation"><NumInput value={rb.inflationPct} onChange={(v) => setF({ inflationPct: v })} suffix="% / yr" /></Field>
              <Field label="Income-tax bracket"><NumInput value={rb.incomeTaxPct} onChange={(v) => setF({ incomeTaxPct: v })} suffix="%" /></Field>
              <Field label="Upkeep + maintenance"><MoneyInput value={rb.maintenanceMonthly} onChange={(v) => setF({ maintenanceMonthly: v })} /></Field>
            </div>
          </div>
        </section>

        <section className="results">
          <div className="panel" style={{ overflow: "hidden" }}>
            <div className="result-hero">
              <div className="rh-inner">
                <div className="rh-label">Over {r.stay} years</div>
                <div className="rh-amount" style={{ fontSize: 40 }}>{verdict.word} wins</div>
                <div className="rh-sub">by about <em>{money(Math.abs(verdict.amt))}</em> in total cost</div>
                <div className="rh-chips">
                  <div className="rh-chip">Net cost to buy<b>{money(r.buyNet)}</b></div>
                  <div className="rh-chip">Net cost to rent<b>{money(r.rentNet)}</b></div>
                  {r.breakeven
                    ? <div className="rh-chip">Buying pays off<b>Year {r.breakeven}</b></div>
                    : <div className="rh-chip">Breakeven<b>&gt; {r.stay} yrs</b></div>}
                </div>
              </div>
            </div>
            <div className="panel-pad">
              <div className="subcard">
                <div className="sc-head"><span className="sc-title">Net cost <em>over time</em></span><span className="sc-tag">Lower is better</span></div>
                <RentBuyChart series={r.series} breakeven={r.breakeven} />
                <div className="legend">
                  <span><i style={{ background: "var(--seg-savings)" }}></i>Buying</span>
                  <span><i style={{ background: "var(--seg-tax)" }}></i>Renting</span>
                </div>
                <div style={{ fontSize: 11.5, color: "var(--ink-soft)", fontWeight: 500, marginTop: 10 }}>
                  {r.breakeven
                    ? `Buying becomes the cheaper option around year ${r.breakeven}. The lines net out home equity, appreciation, tax savings, and the return you'd earn investing your down payment if you rented.`
                    : `Within ${r.stay} years renting stays cheaper here — try a longer time horizon or higher appreciation to see buying pull ahead.`}
                </div>
              </div>
              <div className="cost-group" style={{ marginTop: 6 }}>
                <div className="cost-head"><span>Buying — the numbers</span><span></span></div>
                <CostRow label="Upfront cash (down + closing)" sub={`${deal.downPct}% down`} value={r.upfront} />
                <CostRow label="Home value at sale" sub={`after ${r.stay} yrs`} value={r.finalValue} />
                <CostRow label="Equity recovered at sale" sub="net of commission & payoff" value={r.finalEquity} />
                <CostRow label="Tax savings over period" value={r.totalTaxSave} />
              </div>
              <div className="cost-group">
                <div className="cost-head"><span>Renting — the numbers</span><span></span></div>
                <CostRow label="Total rent paid" sub={`${r.stay} yrs, inflated`} value={r.totalRent} />
              </div>
              <window.BlyShared.Disclaimer />
            </div>
          </div>
          <window.BlyShared.ContactBar cta="Talk Through Your Options" sub="Every situation is different — let's map out the smartest move for you." />
        </section>
      </div>
    );
  }

  /* ===================== REFINANCE ===================== */
  function RefinanceTool({ deal, set }) {
    const [rf, setRf] = useState({
      currentBalance: 260000, currentPayment: 2150, newRate: "5.75", newTermYears: 30,
      homeValue: deal.homePrice, cashOut: "0", originationPct: "1", appraisal: "550",
      recording: "175", escrowFee: "400", rollInCosts: true, priorPolicy: true
    });
    const setF = (patch) => setRf((p) => ({ ...p, ...patch }));

    const r = useMemo(() => M.refinance({
      currentBalance: rf.currentBalance, currentPayment: rf.currentPayment, newRate: rf.newRate,
      newTermYears: rf.newTermYears, homeValue: rf.homeValue, cashOut: rf.cashOut,
      originationPct: rf.originationPct, appraisal: rf.appraisal, recording: rf.recording,
      escrowFee: rf.escrowFee, rollInCosts: rf.rollInCosts, priorPolicy: rf.priorPolicy
    }), [rf]);

    const saves = r.monthlySavings > 0;
    return (
      <div className="grid">
        <section className="panel panel-pad">
          <div className="block">
            <div className="section-label">Your <b>current loan</b></div>
            <div className="two-col">
              <Field label="Current balance"><MoneyInput value={rf.currentBalance} onChange={(v) => setF({ currentBalance: v })} placeholder="260,000" /></Field>
              <Field label="Current payment" hint="Principal & interest"><MoneyInput value={rf.currentPayment} onChange={(v) => setF({ currentPayment: v })} placeholder="2,150" /></Field>
              <Field label="Home value"><MoneyInput value={rf.homeValue} onChange={(v) => setF({ homeValue: v })} /></Field>
              <Field label="Cash out" hint="Extra borrowed"><MoneyInput value={rf.cashOut} onChange={(v) => setF({ cashOut: v })} /></Field>
            </div>
          </div>
          <div className="block">
            <div className="section-label">The <b>new loan</b></div>
            <div className="two-col">
              <Field label="New interest rate"><NumInput value={rf.newRate} onChange={(v) => setF({ newRate: v })} suffix="%" placeholder="5.75" /></Field>
              <Field label="New loan term">
                <div className="seg cols-3">
                  {[30, 20, 15].map((y) => (
                    <button key={y} className={"seg-btn" + (rf.newTermYears === y ? " active" : "")} onClick={() => setF({ newTermYears: y })}>{y} yr</button>
                  ))}
                </div>
              </Field>
            </div>
            <Field>
              <div className={"toggle-row" + (rf.rollInCosts ? " on" : "")} onClick={() => setF({ rollInCosts: !rf.rollInCosts })}>
                <div className="tg"></div>
                <div className="tg-label">Roll closing costs into the loan<small>Finance fees instead of paying cash</small></div>
              </div>
            </Field>
          </div>
          <div className="block">
            <div className="section-label">Refi <b>closing costs</b></div>
            <Field>
              <div className={"toggle-row" + (rf.priorPolicy ? " on" : "")} onClick={() => setF({ priorPolicy: !rf.priorPolicy })}>
                <div className="tg"></div>
                <div className="tg-label">Existing owner's title policy<small>Qualifies for TX reissue / refi rate</small></div>
              </div>
            </Field>
            <div className="two-col">
              <Field label="Loan origination"><NumInput value={rf.originationPct} onChange={(v) => setF({ originationPct: v })} suffix="% loan" /></Field>
              <Field label="Appraisal"><MoneyInput value={rf.appraisal} onChange={(v) => setF({ appraisal: v })} /></Field>
              <Field label="Escrow / closing fee"><MoneyInput value={rf.escrowFee} onChange={(v) => setF({ escrowFee: v })} /></Field>
              <Field label="Recording & gov."><MoneyInput value={rf.recording} onChange={(v) => setF({ recording: v })} /></Field>
            </div>
          </div>
        </section>

        <section className="results">
          <div className="panel" style={{ overflow: "hidden" }}>
            <div className="result-hero">
              <div className="rh-inner">
                <div className="rh-label">New monthly payment (P&amp;I)</div>
                <div className="rh-amount">{money(r.newPI)}<span className="per"> / mo</span></div>
                <div className="rh-sub">{saves ? <span>You'd save <em>{money(r.monthlySavings)}/mo</em></span> : <span>About <em>{money(-r.monthlySavings)}/mo more</em> — but a shorter payoff</span>}</div>
                <div className="rh-chips">
                  <div className="rh-chip">New loan amount<b>{money(r.newLoan)}</b></div>
                  <div className="rh-chip">New LTV<b>{M.pct(r.ltv * 100, 0)}</b></div>
                  {r.breakevenMonths
                    ? <div className="rh-chip">Break-even<b>{r.breakevenMonths} mo</b></div>
                    : <div className="rh-chip">Annual savings<b>{money(r.annualSavings)}</b></div>}
                </div>
              </div>
            </div>
            <div className="panel-pad">
              <div className="subcard">
                <div className="sc-head"><span className="sc-title">Payment <em>comparison</em></span></div>
                <div className="pi-stats">
                  <div className="pi-stat"><div className="k">Current P&amp;I</div><div className="v">{money(r.currentPayment)}</div></div>
                  <div className="pi-stat"><div className="k">New P&amp;I</div><div className="v" style={{ color: saves ? "var(--seg-savings)" : "var(--ink)" }}>{money(r.newPI)}</div></div>
                </div>
                {r.breakevenMonths && (
                  <div style={{ fontSize: 11.5, color: "var(--ink-soft)", fontWeight: 500, marginTop: 12 }}>
                    At {money(r.monthlySavings)}/mo in savings, your {money(r.closingCosts)} in closing costs pay back in about <b>{r.breakevenMonths} months</b> ({(r.breakevenMonths / 12).toFixed(1)} yrs). Refinancing usually makes sense if you'll stay past that point.
                  </div>
                )}
              </div>
              <div className="cost-group" style={{ marginTop: 6 }}>
                <div className="cost-head"><span>Refinance costs</span><span>{money(r.closingCosts)}</span></div>
                {r.costs.map((c, i) => <CostRow key={i} {...c} />)}
                {r.cashOut > 0 && <CostRow label="Cash out to you" sub="added to loan" value={r.cashOut} />}
              </div>
              <window.BlyShared.Disclaimer />
            </div>
          </div>
          <window.BlyShared.ContactBar cta="See If Refinancing Makes Sense" sub="Rates change daily — let's check whether a refi pencils out for you." />
        </section>
      </div>
    );
  }

  /* ===================== INVESTOR (rental analysis) ===================== */
  function InvestorTool({ deal, set, ai }) {
    const [iv, setIv] = useState({
      closingCosts: "6000", monthlyRent: 2400,
      repairsPct: "5", capexPct: "5", vacancyPct: "5", mgmtPct: "8",
      utilitiesMonthly: "0", pointsPct: "0", cashPurchase: false
    });
    const setF = (patch) => setIv((p) => ({ ...p, ...patch }));

    const r = useMemo(() => M.investor({
      purchasePrice: deal.homePrice, rehab: deal.rehab, arv: deal.arv, closingCosts: iv.closingCosts,
      downPct: deal.downPct, rate: deal.rate, termYears: deal.termYears, pointsPct: iv.pointsPct,
      monthlyRent: iv.monthlyRent, taxRatePct: deal.taxRate, insuranceAnnual: deal.insurance,
      vacancyPct: iv.vacancyPct, mgmtPct: iv.mgmtPct, repairsPct: iv.repairsPct, capexPct: iv.capexPct,
      hoaMonthly: deal.hoa, utilitiesMonthly: iv.utilitiesMonthly, cashPurchase: iv.cashPurchase
    }), [deal, iv]);

    const cf = r.cashFlowMonthly >= 0;
    const b = r.breakdown;
    return (
      <div className="grid">
        <section className="panel panel-pad">
          <div className="block">
            <div className="section-label">The <b>deal</b></div>
            <div className="two-col">
              <Field label="Purchase price"><MoneyInput value={deal.homePrice} onChange={(v) => set({ homePrice: v })} placeholder="325,000" /></Field>
              <Field label="After-repair value (ARV)"><MoneyInput value={deal.arv} onChange={(v) => set({ arv: v })} placeholder="325,000" /></Field>
              <Field label="Rehab budget" hint="From Rehab tab"><MoneyInput value={deal.rehab} onChange={(v) => set({ rehab: v })} placeholder="0" /></Field>
              <Field label="Purchase closing costs"><MoneyInput value={iv.closingCosts} onChange={(v) => setF({ closingCosts: v })} placeholder="6,000" /></Field>
            </div>
          </div>
          <div className="block">
            <div className="section-label">Financing</div>
            <Field>
              <div className={"toggle-row" + (iv.cashPurchase ? " on" : "")} onClick={() => setF({ cashPurchase: !iv.cashPurchase })}>
                <div className="tg"></div>
                <div className="tg-label">All-cash purchase<small>No loan — skip down payment & rate</small></div>
              </div>
            </Field>
            {!iv.cashPurchase && (
              <div className="two-col">
                <Field label="Down payment">
                  <div className="seg cols-4">
                    {[15, 20, 25, 30].map((d) => (
                      <button key={d} className={"seg-btn" + (deal.downPct === d ? " active" : "")} onClick={() => set({ downPct: d })}>{d}%</button>
                    ))}
                  </div>
                </Field>
                <Field label="Interest rate"><NumInput value={deal.rate} onChange={(v) => set({ rate: v })} suffix="%" /></Field>
              </div>
            )}
          </div>
          <div className="block">
            <div className="section-label">Rent &amp; <b>operating costs</b></div>
            <Field label="Gross monthly rent"><MoneyInput value={iv.monthlyRent} onChange={(v) => setF({ monthlyRent: v })} placeholder="2,400" /></Field>
            <div className="two-col">
              <Field label="Property tax rate"><NumInput value={deal.taxRate} onChange={(v) => set({ taxRate: v })} suffix="% / yr" /></Field>
              <Field label="Insurance"><MoneyInput value={deal.insurance} onChange={(v) => set({ insurance: v })} /></Field>
              <Field label="Vacancy"><NumInput value={iv.vacancyPct} onChange={(v) => setF({ vacancyPct: v })} suffix="% rent" /></Field>
              <Field label="Management"><NumInput value={iv.mgmtPct} onChange={(v) => setF({ mgmtPct: v })} suffix="% rent" /></Field>
              <Field label="Repairs & maint."><NumInput value={iv.repairsPct} onChange={(v) => setF({ repairsPct: v })} suffix="% rent" /></Field>
              <Field label="CapEx reserve"><NumInput value={iv.capexPct} onChange={(v) => setF({ capexPct: v })} suffix="% rent" /></Field>
              <Field label="HOA dues"><MoneyInput value={deal.hoa} onChange={(v) => set({ hoa: v })} /></Field>
              <Field label="Utilities you pay"><MoneyInput value={iv.utilitiesMonthly} onChange={(v) => setF({ utilitiesMonthly: v })} /></Field>
            </div>
          </div>
        </section>

        <section className="results">
          <div className="panel" style={{ overflow: "hidden" }}>
            <div className="result-hero">
              <div className="rh-inner">
                <div className="rh-label">Monthly cash flow</div>
                <div className="rh-amount">{money(r.cashFlowMonthly)}<span className="per"> / mo</span></div>
                <div className="rh-sub">{money(r.cashFlowMonthly * 12)}/yr after all expenses &amp; <em>debt service</em></div>
                <div className="rh-chips">
                  <div className="rh-chip">Cash-on-cash<b>{M.pct(r.coc * 100, 1)}</b></div>
                  <div className="rh-chip">Cap rate<b>{M.pct(r.capRate * 100, 1)}</b></div>
                  <div className="rh-chip">Cash in deal<b>{money(r.cashInvested)}</b></div>
                </div>
              </div>
            </div>
            <div className="panel-pad">
              <div className={"subcard"} style={{ background: r.meets70 ? "color-mix(in srgb,var(--seg-savings) 8%,var(--panel))" : "color-mix(in srgb,#c0492f 7%,var(--panel))", borderColor: r.meets70 ? "color-mix(in srgb,var(--seg-savings) 26%,var(--line))" : "color-mix(in srgb,#c0492f 22%,var(--line))" }}>
                <div className="sc-head">
                  <span className="sc-title">70% <em>rule</em></span>
                  <span className="sc-tag" style={{ color: "#fff", background: r.meets70 ? "var(--seg-savings)" : "#c0492f", borderColor: "transparent" }}>{r.meets70 ? "PASS" : "OVER"}</span>
                </div>
                <div className="pi-stats">
                  <div className="pi-stat"><div className="k">Max offer (70% of ARV − rehab)</div><div className="v">{money(r.maxOffer)}</div></div>
                  <div className="pi-stat"><div className="k">Your all-in (price + rehab)</div><div className="v">{money(r.allIn)}</div></div>
                </div>
                <div style={{ fontSize: 12.5, color: "var(--ink-soft)", fontWeight: 500, marginTop: 12 }}>
                  {r.meets70
                    ? `All-in is at or below 70% of the $${Number(r.arv).toLocaleString()} ARV — within the classic investor guideline.`
                    : `All-in is above 70% of ARV. To meet the rule you'd want to be under ${money(r.maxOffer)}.`}
                </div>
              </div>

              <div className="cost-group" style={{ marginTop: 6 }}>
                <div className="cost-head"><span>Monthly expenses</span><span>{money(r.opExMonthly + b.pi)}</span></div>
                {b.pi > 0 && <CostRow label="Mortgage (P&I)" value={b.pi} />}
                <CostRow label="Property tax" value={b.taxMonthly} />
                <CostRow label="Insurance" value={b.insMonthly} />
                <CostRow label="Vacancy" sub={iv.vacancyPct + "% of rent"} value={b.vacancy} />
                <CostRow label="Management" sub={iv.mgmtPct + "% of rent"} value={b.mgmt} />
                <CostRow label="Repairs & maintenance" sub={iv.repairsPct + "% of rent"} value={b.repairs} />
                <CostRow label="CapEx reserve" sub={iv.capexPct + "% of rent"} value={b.capex} />
                {b.hoa > 0 && <CostRow label="HOA" value={b.hoa} />}
                {b.utilities > 0 && <CostRow label="Utilities" value={b.utilities} />}
              </div>
              <div className="grand-total" style={{ background: cf ? "linear-gradient(135deg,#15613f,#1d8a59)" : "linear-gradient(135deg,#7a2a1c,#b04631)" }}>
                <span>Monthly cash flow</span><b>{money(r.cashFlowMonthly)}</b>
              </div>

              <div className="cost-group" style={{ marginTop: 16 }}>
                <div className="cost-head"><span>Return metrics</span><span></span></div>
                <CostRow label="Net operating income (NOI)" sub="annual, before debt" value={r.noi} />
                <div className="cost-row"><span className="cost-name">Cap rate<small>NOI ÷ all-in cost</small></span><span className="cost-val">{M.pct(r.capRate * 100, 2)}</span></div>
                <div className="cost-row"><span className="cost-name">Cash-on-cash return<small>annual cash flow ÷ cash invested</small></span><span className="cost-val">{M.pct(r.coc * 100, 2)}</span></div>
                <div className="cost-row"><span className="cost-name">1% rule<small>rent ≥ 1% of price ({money(r.onePctTarget)})</small></span><span className="cost-val" style={{ color: r.meets1 ? "var(--seg-savings)" : "#c0492f" }}>{r.meets1 ? "Pass" : "Below"}</span></div>
              </div>
              <window.BlyShared.Disclaimer />
            </div>
          </div>
          <window.BlyShared.ContactBar cta="Find Your Next Deal" sub="Looking for cash-flowing rentals in the Houston area? Let's build your portfolio." />
        </section>
      </div>
    );
  }

  /* ===================== REHAB ESTIMATOR (+ 70% rule) ===================== */
  const REHAB_CATS = ["Roof", "Exterior", "Kitchen", "Bathrooms", "Flooring", "Interior Paint",
    "Plumbing", "Electrical", "HVAC", "Foundation", "Windows & Doors", "Landscaping", "Permits & Misc"];
  let rehabSeedId = 1;
  const seedRow = (cat, label, cost) => ({ id: rehabSeedId++, cat, label, cost });

  function RehabTool({ deal, set, goTab }) {
    const [items, setItems] = useState([
      seedRow("Roof", "Roof replacement", 9000),
      seedRow("Kitchen", "Cabinets & countertops", 8500),
      seedRow("Bathrooms", "Bathroom remodel", 5000),
      seedRow("Flooring", "Luxury vinyl plank", 6000),
      seedRow("Interior Paint", "Full interior paint", 3500),
      seedRow("HVAC", "HVAC system", 6500)
    ]);
    const [contingencyPct, setContingencyPct] = useState("10");
    const [extraProfit, setExtraProfit] = useState("0");

    const setRow = (id, patch) => setItems((rows) => rows.map((r) => r.id === id ? { ...r, ...patch } : r));
    const addRow = () => setItems((rows) => [...rows, seedRow(REHAB_CATS[0], "", "")]);
    const removeRow = (id) => setItems((rows) => rows.filter((r) => r.id !== id));

    const subtotal = items.reduce((s, r) => s + M.num(r.cost), 0);
    const contingency = subtotal * M.num(contingencyPct) / 100;
    const total = subtotal + contingency;

    // category rollup
    const byCat = {};
    items.forEach((r) => { byCat[r.cat] = (byCat[r.cat] || 0) + M.num(r.cost); });
    const catRows = Object.keys(byCat).filter((c) => byCat[c] > 0).map((c) => ({ cat: c, value: byCat[c] }));

    // push rehab total into shared deal so the Investor tab uses it
    React.useEffect(() => { set({ rehab: Math.round(total) }); }, [total]); // eslint-disable-line

    const arv = M.num(deal.arv);
    const maxOffer = 0.70 * arv - total - M.num(extraProfit);
    const overByPrice = M.num(deal.homePrice) > maxOffer;

    return (
      <div className="grid">
        <section className="panel panel-pad">
          <div className="block">
            <div className="section-label">Renovation <b>line items</b></div>
            <div className="rehab-list">
              <div className="rehab-row rehab-head">
                <span>Category</span><span>Item</span><span>Cost</span><span></span>
              </div>
              {items.map((r) => (
                <div className="rehab-row" key={r.id}>
                  <span className="select-wrap">
                    <select value={r.cat} onChange={(e) => setRow(r.id, { cat: e.target.value })}>
                      {REHAB_CATS.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </span>
                  <input className="txt" value={r.label} placeholder="Describe work"
                    onChange={(e) => setRow(r.id, { label: e.target.value })} />
                  <div className="input-money">
                    <span className="dollar">$</span>
                    <input className="txt has-dollar" inputMode="numeric"
                      value={r.cost === "" ? "" : Number(r.cost).toLocaleString("en-US")}
                      onChange={(e) => setRow(r.id, { cost: e.target.value.replace(/[^0-9]/g, "") })} placeholder="0" />
                  </div>
                  <button className="rehab-x" onClick={() => removeRow(r.id)} aria-label="Remove">×</button>
                </div>
              ))}
            </div>
            <button className="add-line" onClick={addRow}>+ Add line item</button>
            <div className="two-col" style={{ marginTop: 18 }}>
              <Field label="Contingency"><NumInput value={contingencyPct} onChange={setContingencyPct} suffix="% buffer" /></Field>
              <Field label="After-repair value (ARV)"><MoneyInput value={deal.arv} onChange={(v) => set({ arv: v })} placeholder="325,000" /></Field>
            </div>
          </div>
        </section>

        <section className="results">
          <div className="panel" style={{ overflow: "hidden" }}>
            <div className="result-hero">
              <div className="rh-inner">
                <div className="rh-label">Estimated rehab budget</div>
                <div className="rh-amount">{money(total)}</div>
                <div className="rh-sub">{items.length} items + {M.num(contingencyPct)}% <em>contingency</em></div>
                <div className="rh-chips">
                  <div className="rh-chip">Line items<b>{money(subtotal)}</b></div>
                  <div className="rh-chip">Contingency<b>{money(contingency)}</b></div>
                  <div className="rh-chip">$/sq ft ready<b>Investor</b></div>
                </div>
              </div>
            </div>
            <div className="panel-pad">
              <div className="cost-group">
                <div className="cost-head"><span>By category</span><span>{money(subtotal)}</span></div>
                {catRows.map((c, i) => <CostRow key={i} label={c.cat} value={c.value} />)}
                {M.num(contingencyPct) > 0 && <CostRow label="Contingency buffer" sub={contingencyPct + "%"} value={contingency} />}
              </div>
              <div className="grand-total"><span>Total rehab budget</span><b>{money(total)}</b></div>

              {/* 70% RULE */}
              <div className="subcard" style={{ marginTop: 16, background: overByPrice ? "color-mix(in srgb,#c0492f 7%,var(--panel))" : "color-mix(in srgb,var(--seg-savings) 8%,var(--panel))", borderColor: overByPrice ? "color-mix(in srgb,#c0492f 22%,var(--line))" : "color-mix(in srgb,var(--seg-savings) 26%,var(--line))" }}>
                <div className="sc-head">
                  <span className="sc-title">70% rule <em>max offer</em></span>
                  <span className="sc-tag" style={{ color: "#fff", background: overByPrice ? "#c0492f" : "var(--seg-savings)", borderColor: "transparent" }}>{overByPrice ? "OVER" : "WITHIN"}</span>
                </div>
                <div className="savings-big" style={{ color: overByPrice ? "#c0492f" : "var(--seg-savings)" }}>{money(Math.max(0, maxOffer))}</div>
                <div className="savings-row"><span>70% of ARV ({money(arv)})</span><b>{money(0.7 * arv)}</b></div>
                <div className="savings-row"><span>Less rehab budget</span><b>−{money(total)}</b></div>
                <div className="savings-row" style={{ alignItems: "center" }}>
                  <span>Less extra profit target</span>
                  <span style={{ width: 110 }}><MoneyInput value={extraProfit} onChange={setExtraProfit} placeholder="0" /></span>
                </div>
                <div className="savings-row" style={{ borderTop: "1px solid var(--line)", paddingTop: 9, marginTop: 9 }}>
                  <span>Your purchase price</span><b>{money(deal.homePrice)}</b>
                </div>
                <div style={{ fontSize: 11.5, color: "var(--ink-soft)", fontWeight: 500, marginTop: 10 }}>
                  {overByPrice
                    ? `At ${money(deal.homePrice)} you're above the 70% rule max of ${money(Math.max(0, maxOffer))}. Negotiate the price or trim rehab to protect your margin.`
                    : `At ${money(deal.homePrice)} you're at or below the max offer — the deal pencils out under the 70% rule.`}
                </div>
              </div>

              <button className="cta cta-primary" style={{ width: "100%", marginTop: 16 }} onClick={() => goTab && goTab("investor")}>
                Run full investor analysis →
              </button>
              <window.BlyShared.Disclaimer />
            </div>
          </div>
          <window.BlyShared.ContactBar cta="Get Contractor Referrals" sub="Need trusted contractors for the rehab? We'll connect you with our vetted local crew." />
        </section>
      </div>
    );
  }

  window.RentBuyTool = RentBuyTool;
  window.RefinanceTool = RefinanceTool;
  window.InvestorTool = InvestorTool;
  window.RehabTool = RehabTool;
  window.BuyerTool = BuyerTool;
  window.SellerTool = SellerTool;
})();
