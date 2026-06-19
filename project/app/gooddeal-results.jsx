/* gooddeal-results.jsx — the result cards for the Good Deal tab.
   Exposes window.GoodDealResults. */
(function () {
  const { useState } = React;
  const M = window.Mortgage;
  const { CostRow } = window.BlyUI;
  const money = M.money;

  const YEAR_ROWS = [0, 3, 5, 10];

  function GoodDealResults({ R, gd, deal, horizon, apprecRate, rec }) {
    const { base, bc, proj, wealth, tax, trueCost, waiting, rb, score, riskLevel, negPos, strategies } = R;
    const rows = proj.rows;
    const yrLabel = (y) => (y === 0 ? "Today" : "Year " + y);

    return (
      <div className="panel" style={{ overflow: "hidden" }}>
        <div className="panel-pad gd-results">

          {/* RECOMMENDATION */}
          <div className={"gd-rec band-" + rec.band}>
            <div className="gd-rec-tag">Buyer strategy</div>
            <div className="gd-rec-title">{rec.title}</div>
            <div className="gd-rec-body">{rec.body}</div>
          </div>

          {/* EQUITY FORECAST */}
          <div className="subcard">
            <div className="sc-head"><span className="sc-title">Equity <em>forecast</em></span><span className="sc-tag">{apprecRate.toFixed(1)}% / yr</span></div>
            <window.EquityChart rows={rows} selYear={horizon} />
            <div className="legend" style={{ marginBottom: 4 }}>
              <span><i style={{ background: "var(--seg-savings)" }}></i>Your equity</span>
              <span><i style={{ background: "var(--seg-pi)" }}></i>Loan balance</span>
              <span style={{ marginLeft: "auto", color: "var(--ink-faint)" }}>Value grows {apprecRate.toFixed(1)}% / yr</span>
            </div>
            <div className="gd-table-wrap">
              <table className="gd-table">
                <thead><tr><th>Year</th><th>Home value</th><th>Loan balance</th><th>Equity</th></tr></thead>
                <tbody>
                  {YEAR_ROWS.filter((y) => y < rows.length).map((y) => (
                    <tr key={y} className={y === horizon ? "hl" : ""}>
                      <td>{yrLabel(y)}</td><td>{money(rows[y].value)}</td><td>{money(rows[y].balance)}</td>
                      <td className="eq">{money(rows[y].equity)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* WEALTH BUILT */}
          <div className="subcard gd-wealth">
            <div className="sc-head"><span className="sc-title">Wealth <em>built</em></span><span className="sc-tag">By year {horizon}</span></div>
            <div className="gd-wealth-big">{money(wealth.netEquity)}<span> estimated net equity</span></div>
            <div className="cost-row"><span className="cost-name">Principal paid down</span><span className="cost-val">{money(wealth.paydown)}</span></div>
            <div className="cost-row"><span className="cost-name">Appreciation gain</span><span className="cost-val">{money(wealth.apprecGain)}</span></div>
            <div className="cost-row"><span className="cost-name">Total gross equity created</span><span className="cost-val">{money(wealth.grossEquity)}</span></div>
            <div className="cost-row"><span className="cost-name">Estimated selling costs</span><span className="cost-val neg">−{money(wealth.sellingCosts)}</span></div>
            <div className="gd-mini-total"><span>Estimated net equity</span><b>{money(wealth.netEquity)}</b></div>
            <div className="gd-fineprint">Wealth here comes from two engines: paying down your loan <em>and</em> home appreciation. Neither is guaranteed.</div>
          </div>

          {/* TRUE MONTHLY COST */}
          <div className="subcard">
            <div className="sc-head"><span className="sc-title">True <em>monthly cost</em></span><span className="sc-tag">Real ownership</span></div>
            {trueCost.items.map((it, i) => it.value > 0 || i === 0 ? (
              <div className="cost-row" key={i}><span className="cost-name">{it.label}</span><span className="cost-val">{money(it.value)}</span></div>
            ) : null)}
            <div className="cost-row"><span className="cost-name">Less estimated tax benefit</span><span className="cost-val neg">−{money(trueCost.taxBenefit)}</span></div>
            <div className="gd-mini-total"><span>Estimated true monthly cost</span><b>{money(trueCost.trueMonthly)}</b></div>
            <div className="gd-fineprint">Most buyers only see PITI ({money(R.pitiCore)}). This is the real, all-in monthly picture.</div>
          </div>

          {/* TAX REALITY CHECK */}
          <div className="subcard">
            <div className="sc-head"><span className="sc-title">Tax benefit <em>reality check</em></span><span className={"sc-tag " + (tax.itemizes ? "pos" : "")}>{tax.itemizes ? "Itemizing helps" : "Standard wins"}</span></div>
            <div className="cost-row"><span className="cost-name">Year-1 mortgage interest</span><span className="cost-val">{money(tax.interest)}</span></div>
            <div className="cost-row"><span className="cost-name">Deductible property taxes</span><span className="cost-val">{money(tax.deductibleSalt)}<small style={{ display: "block", fontSize: 11, color: "var(--ink-faint)", fontWeight: 500 }}>SALT cap {money(tax.saltCap)}</small></span></div>
            {tax.other > 0 && <div className="cost-row"><span className="cost-name">Other itemized deductions</span><span className="cost-val">{money(tax.other)}</span></div>}
            {tax.pmi > 0 && <div className="cost-row"><span className="cost-name">Mortgage insurance</span><span className="cost-val">{money(tax.pmi)}</span></div>}
            <div className="cost-row strong-row"><span className="cost-name">Potential itemized total</span><span className="cost-val">{money(tax.potential)}</span></div>
            <div className="cost-row"><span className="cost-name">Standard deduction</span><span className="cost-val">−{money(tax.standardDeduction)}</span></div>
            <div className="cost-row"><span className="cost-name">Incremental deduction benefit</span><span className="cost-val">{money(tax.incremental)}</span></div>
            <div className={"gd-mini-total" + (tax.itemizes ? " green" : "")}>
              <span>Estimated annual tax savings</span><b>{money(tax.annualSavings)}</b>
            </div>
            <div className="gd-submetric"><span>≈ {money(tax.monthlySavings)} / month</span><span>at {tax.marginalPct}% marginal rate</span></div>
            {!tax.itemizes && <div className="gd-fineprint">Your deductions don't yet clear the standard deduction, so buying may not lower your federal tax this year. That can change with a larger loan or higher rate.</div>}
          </div>

          {/* COST OF WAITING */}
          <div className="subcard gd-waiting">
            <div className="sc-head"><span className="sc-title">Cost of <em>waiting</em> {waiting.months} mo</span></div>
            <div className="cost-row"><span className="cost-name">Rent paid while waiting</span><span className="cost-val">{money(waiting.rentPaid)}</span></div>
            <div className="cost-row"><span className="cost-name">Missed appreciation</span><span className="cost-val">{money(waiting.missedApprec)}</span></div>
            <div className="cost-row"><span className="cost-name">Additional down payment needed</span><span className="cost-val">{money(waiting.addedDown)}</span></div>
            <div className="cost-row"><span className="cost-name">Higher payments if rates rise</span><span className="cost-val">{waiting.pmtDiffMonthly > 0 ? "+" + money(waiting.pmtDiffMonthly) + "/mo" : money(0)}</span></div>
            <div className="gd-mini-total amber"><span>Estimated total cost of waiting</span><b>{money(waiting.total)}</b></div>
            <div className="gd-fineprint">Waiting may feel safer, but it can have a cost when home prices, rent, and interest rates move against you.</div>
          </div>

          {/* RENT VS BUY SNAPSHOT */}
          <div className="subcard">
            <div className="sc-head"><span className="sc-title">Rent vs. <em>buy</em></span>
              <span className={"sc-tag " + (rb.buyWins ? "pos" : "")}>{rb.buyWins ? "Buying wins" : "Renting wins"}</span></div>
            <div className="gd-rvb-head">{rb.breakeven ? <>Buying beats renting in <b>Year {rb.breakeven}</b></> : <>No breakeven within <b>{horizon} years</b></>}</div>
            <div className="gd-table-wrap">
              <table className="gd-table">
                <thead><tr><th>Horizon</th><th>Better option</th><th>Advantage</th></tr></thead>
                <tbody>
                  {rb.series.filter((s) => [1, 3, 5, 10].includes(s.year)).map((s) => {
                    const buy = s.buyNet <= s.rentNet;
                    return (<tr key={s.year}><td>{s.year} yr</td>
                      <td className={buy ? "eq" : ""}>{buy ? "Buying" : "Renting"}</td>
                      <td>{money(Math.abs(s.rentNet - s.buyNet))}</td></tr>);
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* RISK CHECK */}
          <div className="subcard">
            <div className="sc-head"><span className="sc-title">Property <em>risk</em></span>
              <span className={"risk-badge band-" + riskLevel.band}>{riskLevel.label}</span></div>
            <div className="gd-chips">
              <span className="gd-chip">Flood: {cap(gd.flood)}</span>
              <span className="gd-chip">Windstorm: {gd.windNeeded === "unknown" ? "Unknown" : cap(gd.windNeeded)}</span>
              <span className="gd-chip">Reassessment: {cap(gd.reassess)}</span>
              <span className="gd-chip">Foundation: {gd.foundation === "unknown" ? "Unknown" : cap(gd.foundation)}</span>
              <span className="gd-chip">Roof: {M.num(gd.roofAge)} yrs</span>
              <span className="gd-chip">HVAC: {M.num(gd.hvacAge)} yrs</span>
            </div>
            <div className="gd-fineprint">This local risk check flags costs or property issues that can affect affordability, insurance, resale, and long-term ownership on the Gulf Coast.</div>
          </div>

          {/* NEGOTIATION */}
          <div className="subcard">
            <div className="sc-head"><span className="sc-title">Negotiation <em>position</em></span>
              <span className={"risk-badge band-" + negPos.band}>{negPos.label}</span></div>
            <ul className="gd-strat">
              {strategies.map((s, i) => <li key={i}>{s}</li>)}
            </ul>
          </div>

          {/* DISCLAIMERS */}
          <div className="gd-disclaimers">
            <p>Figures are estimates for planning only and are not a loan commitment, pre-approval, guarantee of terms, or financial advice.</p>
            <p>Mortgage interest, property taxes, insurance, HOA dues, PMI, flood insurance, and closing costs may vary based on lender, county, property, credit profile, loan program, and market conditions.</p>
            <p>Tax savings are estimates only and depend on filing status, itemized deductions, income level, loan size, and current tax law. Consult a licensed tax professional.</p>
            <p>Projected appreciation and equity estimates are not guarantees of future value.</p>
            <p className="ehl">The Bly Team at eXp Realty. Equal Housing Opportunity.</p>
          </div>
        </div>
        <window.BlyShared.ContactBar cta="Review This Deal With Us" sub="Let's pressure-test these numbers together and build your offer strategy." />
      </div>
    );
  }

  function cap(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }

  window.GoodDealResults = GoodDealResults;
})();
