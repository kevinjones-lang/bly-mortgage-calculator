/* gooddeal.jsx — "Good Deal" buyer-confidence consultation tab.
   Pulls the shared deal, layers buyer-specific assumptions, and scores
   the purchase across affordability, equity, rent-vs-buy, risk & tax.
   Exposes window.GoodDealTool. */
(function () {
  const { useState, useMemo } = React;
  const M = window.Mortgage;
  const { Field, MoneyInput, NumInput, CostRow } = window.BlyUI;
  const money = M.money;

  const APPREC = { conservative: 2.0, moderate: 3.5, houston: 4.7, aggressive: 6.0 };
  const SCEN = [
    { key: "conservative", name: "Conservative", sub: "2.0%" },
    { key: "moderate", name: "Moderate", sub: "3.5%" },
    { key: "houston", name: "Houston 30-yr", sub: "4.7%" },
    { key: "aggressive", name: "Aggressive", sub: "6.0%" }
  ];
  const FILINGS = [
    { key: "single", name: "Single" },
    { key: "mfj", name: "Married — joint" },
    { key: "mfs", name: "Married — separate" },
    { key: "hoh", name: "Head of household" }
  ];

  // Segmented radio that matches the existing .seg / .seg-btn styling.
  function Seg({ value, options, onChange, cols }) {
    return (
      <div className={"seg cols-" + (cols || options.length)}>
        {options.map((o) => (
          <button key={o.key} className={"seg-btn" + (value === o.key ? " active" : "")}
            onClick={() => onChange(o.key)}>{o.name}{o.sub && <small>{o.sub}</small>}</button>
        ))}
      </div>
    );
  }

  function Select({ value, options, onChange }) {
    return (
      <div className="select-wrap gd-select">
        <select value={value} onChange={(e) => onChange(e.target.value)}>
          {options.map((o) => <option key={o.key} value={o.key}>{o.name}</option>)}
        </select>
      </div>
    );
  }

  function GoodDealTool({ deal, set }) {
    const [gd, setGd] = useState({
      monthlyIncome: "11000", cashAvailable: "55000",
      apprecScenario: "houston", apprecCustom: "4.7", horizon: 5, sellCostPct: "7",
      rent: "2200", rentGrowth: "3", investReturn: "6",
      waitMonths: 12, rateFuture: "7.0",
      filing: "mfj", marginalPct: deal.bracket || 22, otherItemized: "0", saltCap: "40000", points: "0", pmiDeduct: true,
      maintenance: "250", utilities: "350", lawn: "120", pool: "0", floodAnnual: "0", windAnnual: "1400",
      flood: "unknown", windNeeded: "unknown", reassess: "medium", foundation: "no", roofAge: "10", hvacAge: "8",
      listPrice: "", marketValue: "", daysOnMarket: "21", priceReductions: "0", concessions: "no", inspection: "no", inventory: "balanced", competing: "unknown"
    });
    const setG = (patch) => setGd((p) => ({ ...p, ...patch }));
    const cfg = M.PRODUCTS[deal.product];
    const apprecRate = gd.apprecScenario === "custom" ? M.num(gd.apprecCustom) : APPREC[gd.apprecScenario];
    const horizon = Math.max(1, Math.round(M.num(gd.horizon)) || 5);

    const R = useMemo(() => {
      const base = M.calculate({
        homePrice: deal.homePrice, downPct: deal.downPct, product: deal.product, rate: deal.rate,
        termYears: deal.termYears, taxRatePct: deal.taxRate, insuranceAnnual: deal.insurance,
        hoaMonthly: deal.hoa, taxBracketPct: gd.marginalPct, vaExempt: deal.vaExempt
      });
      const pitiCore = base.pi + base.taxMonthly + base.insMonthly + base.miMonthly;
      const bc = M.buyerClosing({
        homePrice: deal.homePrice, downPct: deal.downPct, rate: deal.rate, taxRatePct: deal.taxRate,
        insuranceAnnual: deal.insurance, originationPct: "1", appraisal: "550", creditInspection: "475",
        escrowFee: "400", survey: "525", recording: "175", prepaidInterestDays: "15", taxEscrowMonths: "3", insEscrowMonths: "3"
      });
      const proj = M.equityProjection({
        homePrice: deal.homePrice, downPct: deal.downPct, product: deal.product, rate: deal.rate,
        termYears: deal.termYears, apprecRate: apprecRate, maxYears: Math.max(horizon, 10), vaExempt: deal.vaExempt
      });
      const wealth = M.wealthBuilt(proj, horizon, gd.sellCostPct);
      const annualPropTax = M.num(deal.homePrice) * M.num(deal.taxRate) / 100;
      const tax = M.taxReality({
        interest: base.year1Interest, propTax: annualPropTax, otherItemized: gd.otherItemized,
        filing: gd.filing, marginalPct: gd.marginalPct, saltCap: gd.saltCap, points: gd.points,
        pmi: gd.pmiDeduct ? base.miMonthly * 12 : 0
      });
      const trueCost = M.trueMonthlyCost({
        piti: pitiCore, hoa: base.hoaMonthly, maintenance: gd.maintenance, utilities: gd.utilities,
        lawn: gd.lawn, pool: gd.pool, floodAnnual: gd.floodAnnual, windAnnual: gd.windAnnual,
        taxBenefitMonthly: tax.monthlySavings
      });
      const waiting = M.costOfWaiting({
        waitMonths: gd.waitMonths, rent: gd.rent, apprecPct: apprecRate, homePrice: deal.homePrice,
        rateNow: deal.rate, rateFuture: gd.rateFuture, downPct: deal.downPct, termYears: deal.termYears
      });
      const rb = M.rentVsBuy({
        homePrice: deal.homePrice, downPayment: base.downPayment, termYears: deal.termYears, rate: deal.rate,
        taxRatePct: deal.taxRate, insuranceAnnual: deal.insurance, monthlyRent: gd.rent, renterInsMonthly: "15",
        inflationPct: gd.rentGrowth, pointsPct: "0", originationPct: "1", pmiAnnualPct: base.miMonthly > 0 ? "0.6" : "0",
        hoaMonthly: deal.hoa, maintenanceMonthly: gd.maintenance, incomeTaxPct: gd.marginalPct,
        savingsRatePct: gd.investReturn, appreciationPct: apprecRate, stayYears: horizon, commissionPct: gd.sellCostPct
      });
      const cashInvested = base.downPayment + bc.closingCosts;
      const score = M.goodDealScore({
        piti: base.totalMonthly, monthlyIncome: gd.monthlyIncome, cashAvailable: gd.cashAvailable, cashToClose: bc.cashToClose,
        cashInvested: cashInvested, netEquityHorizon: wealth.netEquity, horizon: horizon, breakeven: rb.breakeven,
        flood: gd.flood, windNeeded: gd.windNeeded === "yes", roofAge: gd.roofAge, hvacAge: gd.hvacAge,
        foundation: gd.foundation === "yes", reassessRisk: gd.reassess,
        taxIncremental: tax.incremental, standardDeduction: tax.standardDeduction, taxAnnualSavings: tax.annualSavings
      });

      // Property risk level
      let rscore = 0;
      if (gd.flood === "high") rscore += 3; else if (gd.flood === "moderate") rscore += 1.5;
      if (gd.windNeeded === "yes") rscore += 1;
      if (M.num(gd.roofAge) > 20) rscore += 2; else if (M.num(gd.roofAge) > 15) rscore += 1;
      if (M.num(gd.hvacAge) > 15) rscore += 1.5;
      if (gd.foundation === "yes") rscore += 2.5;
      if (gd.reassess === "high") rscore += 1; else if (gd.reassess === "medium") rscore += 0.5;
      const riskLevel = rscore >= 5 ? { label: "Elevated", band: "caution" }
        : rscore >= 2.5 ? { label: "Moderate", band: "fair" } : { label: "Low", band: "strong" };

      // Negotiation position
      const list = M.num(gd.listPrice) || M.num(deal.homePrice);
      const mv = M.num(gd.marketValue) || list;
      let nscore = 0;
      if (list > mv * 1.03) nscore += 2; else if (list > mv) nscore += 1; else if (list < mv * 0.98) nscore -= 1;
      const dom = M.num(gd.daysOnMarket);
      if (dom > 60) nscore += 2.5; else if (dom > 30) nscore += 1.5; else if (dom < 10) nscore -= 1.5;
      nscore += Math.min(2, M.num(gd.priceReductions)); 
      if (gd.concessions === "yes") nscore += 1;
      if (gd.inspection === "yes") nscore += 1;
      if (gd.inventory === "high") nscore += 1.5; else if (gd.inventory === "low") nscore -= 1;
      if (gd.competing === "yes") nscore -= 2.5;
      const negPos = nscore >= 4 ? { label: "Strong Opportunity", band: "strong" }
        : nscore >= 2 ? { label: "Moderate Opportunity", band: "good" }
        : nscore >= 0 ? { label: "Limited Opportunity", band: "fair" }
        : { label: "Competitive Situation", band: "caution" };
      const strategies = [];
      if (nscore >= 2) { strategies.push("Negotiate price toward market value"); strategies.push("Ask for seller concessions or a rate buydown"); }
      if (gd.inspection === "yes") strategies.push("Request repairs or a credit from inspection findings");
      if (dom > 30) strategies.push("Seller may be motivated — test a below-list offer");
      if (gd.competing === "yes") strategies.push("Lead with strong terms and move quickly");
      if (strategies.length === 0) strategies.push("Lead with clean terms; focus on price and timeline");

      return { base, pitiCore, bc, proj, wealth, tax, trueCost, waiting, rb, score, cashInvested, riskLevel, negPos, strategies };
    }, [deal, gd, apprecRate, horizon]);

    const { base, bc, wealth, tax, trueCost, waiting, rb, score } = R;
    const effPayment = base.totalMonthly - tax.monthlySavings;

    // Buyer strategy recommendation (score + horizon aware)
    const rec = useMemo(() => {
      const waitFlag = (rb.breakeven && rb.breakeven > horizon) || (horizon < 3 && score.score < 70);
      if (waitFlag && score.score < 78) return {
        title: "Better to Wait", band: "caution",
        body: "With this timeline, renting or saving more may be the stronger short-term move. Buying tends to pay off once you'll own past the rent-vs-buy breakeven."
      };
      if (score.score >= 85) return {
        title: "Strong Buy", band: "strong",
        body: "Payment is manageable, equity potential is strong, and your timeline is long enough to benefit. This looks like a sound long-term purchase."
      };
      if (score.score >= 70) return {
        title: "Good Opportunity", band: "good",
        body: "The home appears financially reasonable. Still worth reviewing taxes, insurance, condition, and resale factors before you commit."
      };
      if (score.score >= 55) return {
        title: "Fair / Review Carefully", band: "fair",
        body: "The home may work, but consider negotiating price, concessions, repairs, or financing terms to improve the math."
      };
      return {
        title: "Caution", band: "caution",
        body: "Payment, cash to close, condition, or a short ownership timeline may create risk. Let's pressure-test the numbers together before moving."
      };
    }, [score, rb.breakeven, horizon]);

    const dynamicStatement = useMemo(() => {
      const be = rb.breakeven ? `about year ${rb.breakeven}` : `beyond ${horizon} years`;
      if (score.score >= 70) return `Based on these assumptions, this home looks like a ${score.score >= 85 ? "strong" : "solid"} long-term purchase if you plan to own it at least ${rb.breakeven || horizon}–${(rb.breakeven || horizon) + 1} years. Rent-vs-buy turns in your favor ${be}.`;
      if (score.score >= 55) return `This home can work, but the numbers are mixed — negotiating price, concessions, or financing would meaningfully strengthen the deal. Rent-vs-buy breaks even ${be}.`;
      return `On these assumptions the purchase carries real risk for your timeline. Renting or improving terms may be smarter near-term. Rent-vs-buy breaks even ${be}.`;
    }, [score, rb.breakeven, horizon]);

    const metrics = [
      { k: "Monthly payment (PITI)", v: money(base.totalMonthly) },
      { k: "Effective payment after tax estimate", v: money(effPayment), accent: tax.itemizes },
      { k: "Cash to close", v: money(bc.cashToClose) },
      { k: `Estimated ${horizon}-year net equity`, v: money(wealth.netEquity), accent: true },
      { k: "Rent vs. buy breakeven", v: rb.breakeven ? `Year ${rb.breakeven}` : `> ${horizon} yrs` },
      { k: `Cost of waiting ${waiting.months} months`, v: money(waiting.total) },
      { k: "Deal score", v: `${score.score} / 100`, strong: true }
    ];

    return (
      <div className="gd-wrap">
        {/* ===== HERO: score + summary ===== */}
        <section className={"panel gd-hero band-" + score.band}>
          <div className="gd-hero-grid">
            <div className="gd-score-col">
              <div className="gd-eyebrow">Is this a good deal?</div>
              <div className="gd-gauge-wrap">
                <window.ScoreGauge score={score.score} band={score.band} />
                <div className="gd-gauge-num">
                  <div className="gd-num">{score.score}</div>
                  <div className="gd-num-max">/ 100</div>
                </div>
              </div>
              <div className={"gd-rating band-" + score.band}>{score.rating}</div>
            </div>
            <div className="gd-summary-col">
              <div className="gd-statement">{dynamicStatement}</div>
              <div className="gd-metrics">
                {metrics.map((m, i) => (
                  <div key={i} className={"gd-metric" + (m.strong ? " strong" : "")}>
                    <div className="gm-k">{m.k}</div>
                    <div className={"gm-v" + (m.accent ? " accent" : "")}>{m.v}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="gd-disclaimer-note">
            This score is not a guarantee of future value. It is a simplified way to compare affordability, equity potential,
            tax impact, and long-term ownership value.
          </div>
        </section>

        {/* ===== SCORE BREAKDOWN ===== */}
        <section className="panel panel-pad">
          <div className="sc-head"><span className="sc-title">How the <em>score</em> breaks down</span><span className="sc-tag">Weighted</span></div>
          <div className="gd-bars">
            {score.breakdown.map((b) => (
              <div key={b.key} className={"gd-bar" + (b.has ? "" : " muted")}>
                <div className="gb-top"><span className="gb-label">{b.label}</span><span className="gb-w">{Math.round(b.weight * 100)}%</span></div>
                <div className="gb-track"><div className="gb-fill" style={{ width: (b.has ? b.score * 100 : 0) + "%" }}></div></div>
                <div className="gb-note">{b.note}</div>
              </div>
            ))}
          </div>
        </section>

        <div className="grid">
          {/* ===== INPUTS ===== */}
          <section className="panel panel-pad gd-inputs">
            <div className="block">
              <div className="section-label">The <b>purchase</b></div>
              <Field label="Home price"><MoneyInput value={deal.homePrice} onChange={(v) => set({ homePrice: v })} /></Field>
              <Field label="Loan type">
                <div className="seg cols-4">
                  {Object.values(M.PRODUCTS).map((p) => (
                    <button key={p.key} className={"seg-btn" + (deal.product === p.key ? " active" : "")}
                      onClick={() => set({ product: p.key, downPct: M.PRODUCTS[p.key].downOptions.includes(deal.downPct) ? deal.downPct : M.PRODUCTS[p.key].defaultDown })}>{p.name}</button>
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
                <Field label="Interest rate"><NumInput value={deal.rate} onChange={(v) => set({ rate: v })} suffix="%" /></Field>
              </div>
              <div className="two-col">
                <Field label="Loan term">
                  <div className="seg cols-3">
                    {[30, 20, 15].map((y) => (
                      <button key={y} className={"seg-btn" + (deal.termYears === y ? " active" : "")} onClick={() => set({ termYears: y })}>{y} yr</button>
                    ))}
                  </div>
                </Field>
                <Field label="Property tax rate"><NumInput value={deal.taxRate} onChange={(v) => set({ taxRate: v })} suffix="% / yr" /></Field>
              </div>
            </div>

            <div className="block">
              <div className="section-label">Affordability &amp; <b>cash</b></div>
              <div className="two-col">
                <Field label="Gross monthly income" hint="Before tax"><MoneyInput value={gd.monthlyIncome} onChange={(v) => setG({ monthlyIncome: v })} /></Field>
                <Field label="Cash available" hint="For down + closing"><MoneyInput value={gd.cashAvailable} onChange={(v) => setG({ cashAvailable: v })} /></Field>
              </div>
            </div>

            <div className="block">
              <div className="section-label">Growth <b>assumptions</b></div>
              <Field label="Appreciation scenario" hint="Houston 30-yr ≈ 4.7%">
                <Seg value={gd.apprecScenario} options={SCEN} onChange={(v) => setG({ apprecScenario: v })} cols={2} />
              </Field>
              <div className="two-col">
                {gd.apprecScenario === "custom"
                  ? <Field label="Custom appreciation"><NumInput value={gd.apprecCustom} onChange={(v) => setG({ apprecCustom: v })} suffix="% / yr" /></Field>
                  : <Field label="Selling costs at exit"><NumInput value={gd.sellCostPct} onChange={(v) => setG({ sellCostPct: v })} suffix="%" /></Field>}
                <Field label="Ownership timeline"><NumInput value={gd.horizon} onChange={(v) => setG({ horizon: v })} suffix="yrs" /></Field>
              </div>
              <button className="gd-link" onClick={() => setG({ apprecScenario: gd.apprecScenario === "custom" ? "houston" : "custom" })}>
                {gd.apprecScenario === "custom" ? "← Use a preset scenario" : "Enter a custom rate →"}
              </button>
            </div>

            <div className="block">
              <div className="section-label">Rent <b>comparison</b></div>
              <div className="two-col">
                <Field label="Current rent / mo"><MoneyInput value={gd.rent} onChange={(v) => setG({ rent: v })} /></Field>
                <Field label="Annual rent increase"><NumInput value={gd.rentGrowth} onChange={(v) => setG({ rentGrowth: v })} suffix="%" /></Field>
              </div>
              <Field label="Return if you invested the down payment" hint="Opportunity cost of buying"><NumInput value={gd.investReturn} onChange={(v) => setG({ investReturn: v })} suffix="% / yr" /></Field>
            </div>

            <div className="block">
              <div className="section-label">Cost of <b>waiting</b></div>
              <div className="two-col">
                <Field label="Wait period">
                  <Seg value={String(gd.waitMonths)} options={[{ key: "6", name: "6 mo" }, { key: "12", name: "12 mo" }, { key: "24", name: "24 mo" }]} onChange={(v) => setG({ waitMonths: parseInt(v, 10) })} />
                </Field>
                <Field label="Future rate if you wait"><NumInput value={gd.rateFuture} onChange={(v) => setG({ rateFuture: v })} suffix="%" /></Field>
              </div>
            </div>

            <div className="block">
              <div className="section-label">Tax <b>picture</b></div>
              <div className="two-col">
                <Field label="Filing status"><Select value={gd.filing} options={FILINGS} onChange={(v) => setG({ filing: v })} /></Field>
                <Field label="Marginal bracket">
                  <Select value={String(gd.marginalPct)} options={[10, 12, 22, 24, 32, 35, 37].map((b) => ({ key: String(b), name: b + "%" }))} onChange={(v) => setG({ marginalPct: parseInt(v, 10) })} />
                </Field>
              </div>
              <div className="two-col">
                <Field label="Other itemized deductions"><MoneyInput value={gd.otherItemized} onChange={(v) => setG({ otherItemized: v })} /></Field>
                <Field label="SALT cap" hint="$40k for 2025"><MoneyInput value={gd.saltCap} onChange={(v) => setG({ saltCap: v })} /></Field>
              </div>
              <div className={"toggle-row" + (gd.pmiDeduct ? " on" : "")} onClick={() => setG({ pmiDeduct: !gd.pmiDeduct })}>
                <div className="tg"></div>
                <div className="tg-label">Treat mortgage insurance as deductible<small>Optional — depends on income & current law</small></div>
              </div>
            </div>

            <div className="block">
              <div className="section-label">True monthly <b>cost extras</b></div>
              <div className="two-col">
                <Field label="Maintenance reserve"><MoneyInput value={gd.maintenance} onChange={(v) => setG({ maintenance: v })} /></Field>
                <Field label="Utilities"><MoneyInput value={gd.utilities} onChange={(v) => setG({ utilities: v })} /></Field>
                <Field label="Lawn care"><MoneyInput value={gd.lawn} onChange={(v) => setG({ lawn: v })} /></Field>
                <Field label="Pool care"><MoneyInput value={gd.pool} onChange={(v) => setG({ pool: v })} /></Field>
                <Field label="Flood insurance / yr"><MoneyInput value={gd.floodAnnual} onChange={(v) => setG({ floodAnnual: v })} /></Field>
                <Field label="Windstorm insurance / yr"><MoneyInput value={gd.windAnnual} onChange={(v) => setG({ windAnnual: v })} /></Field>
              </div>
            </div>

            <div className="block">
              <div className="section-label">Houston / Gulf Coast <b>risk check</b></div>
              <Field label="Flood zone">
                <Seg value={gd.flood} options={[{ key: "low", name: "Low" }, { key: "moderate", name: "Moderate" }, { key: "high", name: "High" }, { key: "unknown", name: "Unknown" }]} onChange={(v) => setG({ flood: v })} cols={4} />
              </Field>
              <div className="two-col">
                <Field label="Windstorm insurance needed">
                  <Seg value={gd.windNeeded} options={[{ key: "no", name: "No" }, { key: "yes", name: "Yes" }, { key: "unknown", name: "?" }]} onChange={(v) => setG({ windNeeded: v })} />
                </Field>
                <Field label="Tax reassessment risk">
                  <Seg value={gd.reassess} options={[{ key: "low", name: "Low" }, { key: "medium", name: "Med" }, { key: "high", name: "High" }]} onChange={(v) => setG({ reassess: v })} />
                </Field>
              </div>
              <div className="two-col">
                <Field label="Foundation concern">
                  <Seg value={gd.foundation} options={[{ key: "no", name: "No" }, { key: "yes", name: "Yes" }, { key: "unknown", name: "?" }]} onChange={(v) => setG({ foundation: v })} />
                </Field>
                <Field label="Roof age"><NumInput value={gd.roofAge} onChange={(v) => setG({ roofAge: v })} suffix="yrs" /></Field>
              </div>
              <Field label="HVAC age"><NumInput value={gd.hvacAge} onChange={(v) => setG({ hvacAge: v })} suffix="yrs" /></Field>
            </div>

            <div className="block">
              <div className="section-label">Negotiation <b>position</b></div>
              <div className="two-col">
                <Field label="List price"><MoneyInput value={gd.listPrice} onChange={(v) => setG({ listPrice: v })} placeholder={String(deal.homePrice)} /></Field>
                <Field label="Estimated market value"><MoneyInput value={gd.marketValue} onChange={(v) => setG({ marketValue: v })} placeholder={String(deal.homePrice)} /></Field>
                <Field label="Days on market"><NumInput value={gd.daysOnMarket} onChange={(v) => setG({ daysOnMarket: v })} suffix="days" /></Field>
                <Field label="Price reductions"><NumInput value={gd.priceReductions} onChange={(v) => setG({ priceReductions: v })} /></Field>
              </div>
              <div className="two-col">
                <Field label="Inventory level">
                  <Seg value={gd.inventory} options={[{ key: "low", name: "Low" }, { key: "balanced", name: "Balanced" }, { key: "high", name: "High" }]} onChange={(v) => setG({ inventory: v })} />
                </Field>
                <Field label="Competing offers">
                  <Seg value={gd.competing} options={[{ key: "no", name: "No" }, { key: "yes", name: "Yes" }, { key: "unknown", name: "?" }]} onChange={(v) => setG({ competing: v })} />
                </Field>
              </div>
              <div className="two-col">
                <Field label="Seller concessions offered">
                  <Seg value={gd.concessions} options={[{ key: "no", name: "No" }, { key: "yes", name: "Yes" }, { key: "unknown", name: "?" }]} onChange={(v) => setG({ concessions: v })} />
                </Field>
                <Field label="Inspection concerns">
                  <Seg value={gd.inspection} options={[{ key: "no", name: "No" }, { key: "yes", name: "Yes" }, { key: "unknown", name: "?" }]} onChange={(v) => setG({ inspection: v })} />
                </Field>
              </div>
            </div>
          </section>

          {/* ===== RESULTS ===== */}
          <section className="results">
            <window.GoodDealResults R={R} gd={gd} deal={deal} horizon={horizon} apprecRate={apprecRate} rec={rec} />
          </section>
        </div>
      </div>
    );
  }

  window.GoodDealTool = GoodDealTool;
})();
