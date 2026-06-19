/* app.jsx — The Bly Team Buyer & Seller Calculator (tabbed shell + Payment tool) */
const { useState, useEffect, useMemo } = React;
const M = window.Mortgage;
const { Field, MoneyInput, NumInput, CostRow, YearSelect, Choice, IcCal, IcPin, IcShield, Chev, Spark } = window.BlyUI;

const BRACKETS = [10, 12, 22, 24, 32, 35, 37];
const HAR_SEARCH_URL = "https://www.har.com/idx/mls/search?sitetype=aws&cid=657148&mlsorgid=1&allmls=n&for_sale=1";
// Freddie Mac PMMS weekly averages — update weekly. FRED: MORTGAGE30US / MORTGAGE15US
const FRED_RATES = { thirty: 6.48, fifteen: 5.79, asOf: "Jun 4, 2026" };
const FRED_URL = "https://fred.stlouisfed.org/series/MORTGAGE30US";

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "theme": "data",
  "radius": 18,
  "showSavings": true,
  "showAmort": true
}/*EDITMODE-END*/;

/* =========================================================
   PAYMENT (PITI) TOOL
   ========================================================= */
function PaymentTool({ deal, set, ai, tweaks }) {
  const t = tweaks;
  const [showAmortTable, setShowAmortTable] = useState(false);
  const [showOptional, setShowOptional] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [email, setEmail] = useState("");
  const [showClosing, setShowClosing] = useState(false);
  const [fees, setFees] = useState({
    originationPct: "1", appraisal: "550", creditInspection: "475", escrowFee: "400",
    survey: "525", recording: "175", prepaidInterestDays: "15", taxEscrowMonths: "3", insEscrowMonths: "3",
    sellerConcessions: "0"
  });
  const setFee = (patch) => setFees((p) => ({ ...p, ...patch }));
  const [selYear, setSelYear] = useState(5);
  const [buydown, setBuydown] = useState(0);
  const cfg = M.PRODUCTS[deal.product];

  useEffect(() => {
    if (!cfg.downOptions.includes(deal.downPct)) set({ downPct: cfg.defaultDown });
  }, [deal.product]); // eslint-disable-line

  const baseRate = M.num(deal.rate);
  const effRate = Math.max(0, +(baseRate - buydown).toFixed(3));
  const r = useMemo(() => M.calculate({
    homePrice: deal.homePrice, downPct: deal.downPct, product: deal.product, rate: effRate,
    termYears: deal.termYears, taxRatePct: deal.taxRate, insuranceAnnual: deal.insurance,
    hoaMonthly: deal.hoa, taxBracketPct: deal.bracket, vaExempt: deal.vaExempt
  }), [deal, buydown]);
  const rBase = useMemo(() => M.calculate({
    homePrice: deal.homePrice, downPct: deal.downPct, product: deal.product, rate: baseRate,
    termYears: deal.termYears, taxRatePct: deal.taxRate, insuranceAnnual: deal.insurance,
    hoaMonthly: deal.hoa, taxBracketPct: deal.bracket, vaExempt: deal.vaExempt
  }), [deal]);
  const buydownPoints = buydown / 0.25;
  const buydownCost = buydownPoints * 0.01 * r.loanAmount;
  const buydownMoSavings = Math.max(0, rBase.totalMonthly - r.totalMonthly);
  const buydownIntSavings = Math.max(0, rBase.totalInterest - r.totalInterest);

  const cc = useMemo(() => M.buyerClosing({
    homePrice: deal.homePrice, downPct: deal.downPct, rate: deal.rate,
    taxRatePct: deal.taxRate, insuranceAnnual: deal.insurance,
    originationPct: fees.originationPct, appraisal: fees.appraisal, creditInspection: fees.creditInspection,
    escrowFee: fees.escrowFee, survey: fees.survey, recording: fees.recording,
    prepaidInterestDays: fees.prepaidInterestDays, taxEscrowMonths: fees.taxEscrowMonths, insEscrowMonths: fees.insEscrowMonths,
    sellerConcessions: fees.sellerConcessions
  }), [deal, fees]);
  const CONCESSION_CAP = { conventional: deal.downPct >= 10 ? 6 : 3, fha: 6, va: 4 };
  const capPct = CONCESSION_CAP[deal.product] || 3;
  const capDollars = M.num(deal.homePrice) * capPct / 100;

  const money = M.money;
  const miLabel = r.miType || "Mortgage insurance";
  const segments = [
    { label: "Principal & Interest", value: r.pi, color: "var(--seg-pi)" },
    { label: "Property tax", value: r.taxMonthly, color: "var(--seg-tax)" },
    { label: "Insurance", value: r.insMonthly, color: "var(--seg-ins)" },
    { label: miLabel, value: r.miMonthly, color: "var(--seg-mi)" },
    { label: "HOA", value: r.hoaMonthly, color: "var(--seg-hoa)" }
  ];
  const pmiCancelText = r.pmiCancelMonth
    ? `PMI drops off around year ${Math.ceil(r.pmiCancelMonth / 12)} (month ${r.pmiCancelMonth}), lowering your payment by ${money(r.miMonthly)}/mo.`
    : null;

  // selected-year detail for the principal/interest + tax cards
  useEffect(() => { if (selYear > deal.termYears) setSelYear(deal.termYears); }, [deal.termYears]); // eslint-disable-line
  const yrSel = Math.max(1, Math.min(selYear, r.byYear.length));
  const yd = r.byYear[yrSel - 1] || { interest: r.year1Interest, principal: r.year1Principal };
  const yrTaxSavings = yd.interest * M.num(deal.bracket) / 100;
  const yrMonthlySavings = yrTaxSavings / 12;

  const emailBody = () => [
    "Here is my mortgage estimate from The Bly Team:",
    "",
    "Home price: " + money(deal.homePrice),
    "Loan type: " + cfg.name + " \u00b7 " + deal.termYears + "-yr fixed",
    "Down payment: " + money(r.downPayment) + " (" + deal.downPct + "%)",
    "Loan amount: " + money(r.loanAmount),
    "Interest rate: " + M.pct(r.rate),
    "",
    "Estimated monthly payment (PITI): " + money(r.totalMonthly),
    "  - Principal & interest: " + money(r.pi),
    "  - Property tax: " + money(r.taxMonthly),
    "  - Insurance: " + money(r.insMonthly),
    r.miMonthly > 0 ? "  - " + miLabel + ": " + money(r.miMonthly) : null,
    M.num(deal.hoa) > 0 ? "  - HOA dues: " + money(r.hoaMonthly) : null,
    "",
    "Estimated cash to close: " + money(cc.cashToClose),
    "  - Down payment: " + money(cc.down),
    "  - Closing costs: " + money(cc.closingCosts),
    "  - Prepaids & escrow: " + money(cc.prepaids),
    cc.sellerConcessions > 0 ? "  - Seller concessions: -" + money(cc.sellerConcessions) : null,
    "",
    buydown > 0 ? "Seller-paid rate buydown: -" + buydown.toFixed(2) + "% to " + M.pct(effRate) + " (cost " + money(buydownCost) + ", saves " + money(buydownMoSavings) + "/mo)" : null,
    buydown > 0 ? "" : null,
    "Estimates only - not a loan commitment or guarantee of terms.",
    "Let's run your real numbers: (832) 932-5435 - clientcare@agentbly.com",
    "The Bly Team - eXp Realty - Equal Housing Opportunity"
  ].filter(Boolean).join("\n");

  const sendEmail = () => {
    const url = "mailto:" + encodeURIComponent(email || "") +
      "?subject=" + encodeURIComponent("Your Bly Team mortgage estimate") +
      "&body=" + encodeURIComponent(emailBody());
    window.location.href = url;
  };

  return (
    <>
      <div className="pay-summary">
        <div className="ps-inner">
          <div className="ps-item">
            <div className="ps-label">Estimated monthly payment</div>
            <div className="ps-value">{money(r.totalMonthly)}<span className="ps-per">/mo</span></div>
          </div>
          <div className="ps-div"></div>
          <div className="ps-item">
            <div className="ps-label">Cash to close</div>
            <div className="ps-value">{money(cc.cashToClose)}</div>
          </div>
        </div>
      </div>
    <div className="grid">
      {/* INPUTS */}
      <section className="panel panel-pad">
        <div className="block">
          <div className="section-label">Your <b>home &amp; loan</b></div>
          <Field label="Home price">
            <MoneyInput value={deal.homePrice} onChange={(v) => set({ homePrice: v })} placeholder="325,000" />
          </Field>
          <Field label="Loan type">
            <div className="loan-type-grid">
              {Object.values(M.PRODUCTS).map((p) => (
                <button key={p.key} className={"lt-btn" + (deal.product === p.key ? " active" : "")}
                  onClick={() => set({ product: p.key })}>
                  <div className="lt-name">{p.name}</div>
                  <div className="lt-blurb">{p.blurb}</div>
                </button>
              ))}
            </div>
          </Field>
          <Field label="Down payment" hint={money(r.downPayment) + " · " + M.pct(r.ltv * 100, 0) + " LTV"}>
            <Choice value={deal.downPct} onChange={(v) => set({ downPct: v })}
              options={cfg.downOptions.map((d) => ({ value: d, label: d + "%", sub: money(deal.homePrice * d / 100) }))} />
          </Field>
          {deal.product === "va" && (
            <Field>
              <div className={"toggle-row" + (deal.vaExempt ? " on" : "")} onClick={() => set({ vaExempt: !deal.vaExempt })}>
                <div className="tg"></div>
                <div className="tg-label">VA funding fee exempt<small>Service-connected disability waives the fee</small></div>
              </div>
            </Field>
          )}
          <div className="two-col">
            <Field label="Interest rate" hint={"Wk of " + FRED_RATES.asOf}>
              <NumInput value={deal.rate} onChange={(v) => set({ rate: v })} suffix="%" placeholder="6.25" />
              <div className="rate-hint">
                <button className="rate-pill" onClick={() => set({ rate: String(deal.termYears <= 15 ? FRED_RATES.fifteen : FRED_RATES.thirty) })}>
                  Use this week's avg · {(deal.termYears <= 15 ? FRED_RATES.fifteen : FRED_RATES.thirty)}%
                </button>
                <a className="rate-src" href={FRED_URL} target="_blank" rel="noopener noreferrer">FRED ↗</a>
              </div>
            </Field>
            <Field label="Loan term">
              <div className="seg cols-3">
                {[30, 20, 15].map((y) => (
                  <button key={y} className={"seg-btn" + (deal.termYears === y ? " active" : "")}
                    onClick={() => set({ termYears: y })}>{y} yr</button>
                ))}
              </div>
            </Field>
          </div>
        </div>

        <div className="block">
          <button className={"expand-btn" + (showOptional ? " open" : "")} onClick={() => setShowOptional(!showOptional)}>
            <span>Taxes, insurance &amp; dues <em style={{ fontFamily: "var(--f-serif)", textTransform: "none", letterSpacing: 0, color: "var(--royal)" }}>· optional</em></span><Chev />
          </button>
          {showOptional ? (
            <div style={{ marginTop: 16 }}>
              <AddressEstimator deal={deal} ai={ai} />
              <div className="two-col">
                <Field label="Property tax rate">
                  <NumInput value={deal.taxRate} onChange={(v) => set({ taxRate: v })} suffix="% / yr" placeholder="2.0" />
                </Field>
                <Field label="Home insurance">
                  <MoneyInput value={deal.insurance} onChange={(v) => set({ insurance: v })} placeholder="2,800" />
                </Field>
              </div>
              <Field label="HOA dues" hint="Monthly, if any">
                <MoneyInput value={deal.hoa} onChange={(v) => set({ hoa: v })} placeholder="0" />
              </Field>
            </div>
          ) : (
            <div style={{ fontSize: 13.5, color: "var(--ink-faint)", fontWeight: 500, marginTop: 10, lineHeight: 1.5 }}>
              Estimated with {M.pct(M.num(deal.taxRate))} property tax and {money(deal.insurance)}/yr insurance{M.num(deal.hoa) > 0 ? ", " + money(deal.hoa) + "/mo HOA" : ""}. Tap to fine-tune.
            </div>
          )}
        </div>

        <div className="block">
          <button className={"expand-btn" + (showClosing ? " open" : "")} onClick={() => setShowClosing(!showClosing)}>
            <span>Closing costs &amp; seller credits <em style={{ fontFamily: "var(--f-serif)", textTransform: "none", letterSpacing: 0, color: "var(--royal)" }}>· optional</em></span><Chev />
          </button>
          {showClosing ? (
            <div style={{ marginTop: 16 }}>
              <div className="two-col">
                <Field label="Loan origination"><NumInput value={fees.originationPct} onChange={(v) => setFee({ originationPct: v })} suffix="% loan" /></Field>
                <Field label="Appraisal"><MoneyInput value={fees.appraisal} onChange={(v) => setFee({ appraisal: v })} /></Field>
                <Field label="Credit + inspection"><MoneyInput value={fees.creditInspection} onChange={(v) => setFee({ creditInspection: v })} /></Field>
                <Field label="Escrow / closing fee"><MoneyInput value={fees.escrowFee} onChange={(v) => setFee({ escrowFee: v })} /></Field>
                <Field label="Survey"><MoneyInput value={fees.survey} onChange={(v) => setFee({ survey: v })} /></Field>
                <Field label="Recording &amp; gov."><MoneyInput value={fees.recording} onChange={(v) => setFee({ recording: v })} /></Field>
              </div>
              <div className="section-label" style={{ marginTop: 18 }}>Prepaids &amp; <b>escrow reserves</b></div>
              <div className="two-col">
                <Field label="Prepaid interest"><NumInput value={fees.prepaidInterestDays} onChange={(v) => setFee({ prepaidInterestDays: v })} suffix="days" /></Field>
                <Field label="Tax reserve"><NumInput value={fees.taxEscrowMonths} onChange={(v) => setFee({ taxEscrowMonths: v })} suffix="months" /></Field>
                <Field label="Insurance reserve"><NumInput value={fees.insEscrowMonths} onChange={(v) => setFee({ insEscrowMonths: v })} suffix="months" /></Field>
              </div>
              <div className="section-label" style={{ marginTop: 18 }}>Seller <b>concessions</b></div>
              <Field label="Credit toward buyer costs" hint={cfg.name + " cap ≈ " + capPct + "% (" + money(capDollars) + ")"}>
                <MoneyInput value={fees.sellerConcessions} onChange={(v) => setFee({ sellerConcessions: v })} placeholder="0" />
              </Field>
              <Choice value={M.num(fees.sellerConcessions)} onChange={(v) => setFee({ sellerConcessions: String(v) })}
                options={[{ value: 0, label: "None", sub: money(0) }, { value: Math.round(capDollars / 2), label: "Half cap", sub: money(Math.round(capDollars / 2)) }, { value: Math.round(capDollars), label: "Max cap", sub: money(Math.round(capDollars)) }]} />
              <div className="buyer-note">Seller credits offset closing costs and prepaids — they can’t reduce the down payment, and lenders cap them by loan type.</div>
            </div>
          ) : (
            <div style={{ fontSize: 13.5, color: "var(--ink-faint)", fontWeight: 500, marginTop: 10, lineHeight: 1.5 }}>
              Estimated cash to close: {money(cc.cashToClose)}. Tap to adjust lender fees, prepaids, and seller credits.
            </div>
          )}
        </div>
      </section>

      {/* RESULTS */}
      <section className="results">
        <div className="panel" style={{ overflow: "hidden" }}>
          <div className="result-hero">
            <div className="rh-inner">
              <div className="rh-label">Estimated monthly payment</div>
              <div className="rh-amount">{money(r.totalMonthly)}<span className="per"> / mo</span></div>
              <div className="rh-sub">{cfg.name} · {deal.termYears}-yr fixed · <em>full PITI{r.miMonthly > 0 ? " + " + miLabel : ""}</em></div>
              <div className="rh-chips">
                <div className="rh-chip">Loan amount<b>{money(r.loanAmount)}</b></div>
                <div className="rh-chip">Cash down<b>{money(r.downPayment)}</b></div>
                <div className="rh-chip">Rate<b>{M.pct(r.rate)}</b></div>
              </div>
            </div>
          </div>
          <div className="panel-pad">
            <PitiBar segments={segments} />
            <div className="breakdown">
              {segments.map((s, i) => s.value > 0 || i < 3 ? (
                <div className="bd-row" key={i}>
                  <span className="bd-dot" style={{ background: s.color }}></span>
                  <span className="bd-name">{s.label}
                    {i === 1 && <small>{M.pct(M.num(deal.taxRate))} of value / yr</small>}
                    {i === 3 && r.miMonthly > 0 && <small>{cfg.key === "conventional" ? "Removable at 78% LTV" : "Included in payment"}</small>}
                  </span>
                  <span className="bd-val">{money(s.value)}</span>
                </div>
              ) : null)}
              <div className="bd-row total">
                <span className="bd-dot" style={{ background: "transparent" }}></span>
                <span className="bd-name">Total monthly (PITI)</span>
                <span className="bd-val">{money(r.totalMonthly)}</span>
              </div>
            </div>

            <div className="subcard" style={{ marginTop: 20 }}>
              <div className="sc-head"><span className="sc-title">Cash to <em>close</em></span><span className="sc-tag">{cc.downPct}% down</span></div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
                <span style={{ fontSize: 15, color: "var(--ink-soft)", fontWeight: 600 }}>Estimated cash to close</span>
                <span style={{ fontFamily: "var(--f-display)", fontWeight: 700, fontSize: 34, color: "var(--royal-bright)", letterSpacing: ".01em" }}>{money(cc.cashToClose)}</span>
              </div>
              <div className="cost-row"><span className="cost-name">Down payment</span><span className="cost-val">{money(cc.down)}</span></div>
              <div className="cost-row"><span className="cost-name">Closing costs<small>lender, title &amp; government</small></span><span className="cost-val">{money(cc.closingCosts)}</span></div>
              <div className="cost-row"><span className="cost-name">Prepaids &amp; escrow reserves</span><span className="cost-val">{money(cc.prepaids)}</span></div>
              {cc.sellerConcessions > 0 && (
                <div className="cost-row"><span className="cost-name">Seller concessions<small>{cc.concessionsCapped ? "capped at program max" : "negotiated credit"}</small></span><span className="cost-val credit">−{money(cc.sellerConcessions)}</span></div>
              )}
            </div>

            <div className="subcard" style={{ marginTop: 15 }}>
              <div className="sc-head"><span className="sc-title">Rate <em>buydown</em></span><span className="sc-tag">Seller-paid</span></div>
              <div style={{ fontSize: 14, color: "var(--ink-soft)", fontWeight: 500, marginBottom: 12, lineHeight: 1.5 }}>A seller contribution can permanently lower your rate. Each 0.25% costs about 1% of the loan.</div>
              <Choice value={buydown} onChange={setBuydown}
                options={[
                  { value: 0, label: "No buydown" },
                  { value: 0.25, label: "\u22120.25%" },
                  { value: 0.5, label: "\u22120.50%" },
                  { value: 0.75, label: "\u22120.75%" },
                  { value: 1, label: "\u22121.00%" }
                ]} />
              {buydown > 0 ? (
                <div style={{ marginTop: 14 }}>
                  <div className="savings-row" style={{ marginTop: 0 }}><span>New interest rate</span><b>{M.pct(effRate)} <span style={{ color: "var(--ink-faint)", fontWeight: 500 }}>from {M.pct(baseRate)}</span></b></div>
                  <div className="savings-row"><span>Seller contribution needed</span><b>{money(buydownCost)}</b></div>
                  <div className="savings-row"><span>New monthly payment</span><b>{money(r.totalMonthly)}/mo</b></div>
                  <div className="savings-row" style={{ borderTop: "1px solid var(--line)", paddingTop: 10, marginTop: 10 }}><span>You save</span><b style={{ color: "var(--seg-savings)" }}>{money(buydownMoSavings)}/mo · {money(buydownIntSavings)} over the loan</b></div>
                </div>
              ) : (
                <div style={{ fontSize: 13, color: "var(--ink-faint)", fontWeight: 500, marginTop: 6, lineHeight: 1.5 }}>At today’s rate, a 0.25% buydown runs about {money(0.01 * r.loanAmount)} in seller contribution. Pick a reduction to see the impact.</div>
              )}
            </div>

            <div style={{ marginTop: 18 }}>
              <button className={"expand-btn" + (showDetail ? " open" : "")} onClick={() => setShowDetail(!showDetail)}>
                <span>{showDetail ? "Hide full breakdown" : "Show equity, tax savings & amortization"}</span><Chev />
              </button>
            </div>
            {showDetail && (<>
            <div className="subcard" style={{ marginTop: 16 }}>
              <div className="sc-head"><span className="sc-title">What you're <em>building</em></span><YearSelect value={yrSel} max={deal.termYears} onChange={setSelYear} /></div>
              <div className="pi-split">
                <div className="p" style={{ width: (yd.principal / (yd.principal + yd.interest) * 100 || 0) + "%" }}></div>
                <div className="i" style={{ flex: 1 }}></div>
              </div>
              <div className="pi-stats">
                <div className="pi-stat"><div className="k"><i style={{ background: "var(--seg-pi)" }}></i>To principal (equity)</div><div className="v">{money(yd.principal)}</div></div>
                <div className="pi-stat"><div className="k"><i style={{ background: "var(--seg-interest)" }}></i>To interest</div><div className="v">{money(yd.interest)}</div></div>
              </div>
              <div style={{ fontSize: 14, color: "var(--ink-faint)", fontWeight: 500, marginTop: 12, lineHeight: 1.5 }}>In year {yrSel}, {money(yd.principal)} of your payments build equity vs. {money(yd.interest)} toward interest.</div>
            </div>

            {t.showSavings && (
              <div className="subcard savings-card">
                <div className="sc-head"><span className="sc-title">Estimated tax <em>savings</em></span><YearSelect value={yrSel} max={deal.termYears} onChange={setSelYear} /></div>
                <div className="savings-big">{money(yrTaxSavings)}<span style={{ fontSize: 16, fontWeight: 500 }}> / yr</span></div>
                <div style={{ fontSize: 14.5, color: "var(--ink-soft)", fontWeight: 500, marginTop: 7, lineHeight: 1.5 }}>Mortgage interest is tax-deductible. Pick your marginal bracket:</div>
                <div style={{ marginTop: 9 }}>
                  <Choice value={deal.bracket} onChange={(v) => set({ bracket: v })}
                    options={BRACKETS.map((b) => ({ value: b, label: b + "% bracket" }))} />
                </div>
                <div className="savings-row"><span>Year {yrSel} deductible interest</span><b>{money(yd.interest)}</b></div>
                <div className="savings-row"><span>Est. savings per month</span><b>{money(yrMonthlySavings)}</b></div>
                <div className="savings-row" style={{ borderTop: "1px solid var(--line)", paddingTop: 10, marginTop: 10 }}>
                  <span>Effective payment after savings</span><b style={{ color: "var(--seg-savings)" }}>{money(r.totalMonthly - yrMonthlySavings)}/mo</b>
                </div>
              </div>
            )}

            {t.showAmort && (
              <div className="subcard">
                <div className="sc-head"><span className="sc-title">Principal vs. <em>interest</em></span><span className="sc-tag">{deal.termYears}-yr life</span></div>
                <AmortChart byYear={r.byYear} />
                <div className="legend">
                  <span><i style={{ background: "var(--seg-pi)" }}></i>Principal</span>
                  <span><i style={{ background: "var(--seg-interest)" }}></i>Interest</span>
                  <span style={{ marginLeft: "auto", color: "var(--ink-faint)" }}>Total interest: {money(r.totalInterest)}</span>
                </div>
                {pmiCancelText && <div style={{ fontSize: 11.5, color: "var(--ink-soft)", fontWeight: 500, marginTop: 10 }}>{pmiCancelText}</div>}
              </div>
            )}

            <div className="subcard">
              <div className="sc-head"><span className="sc-title">{cfg.name} loan <em>notes</em></span></div>
              <ul className="foot-list">{r.footnotes.map((f, i) => <li key={i}>{f}</li>)}</ul>
            </div>

            {t.showAmort && (
              <div style={{ marginTop: 18 }}>
                <button className={"expand-btn" + (showAmortTable ? " open" : "")} onClick={() => setShowAmortTable(!showAmortTable)}>
                  <span>Year-by-year schedule</span><Chev />
                </button>
                {showAmortTable && (
                  <div className="amort-scroll">
                    <table className="amort-table">
                      <thead><tr><th>Year</th><th>Principal</th><th>Interest</th><th>Balance</th></tr></thead>
                      <tbody>{r.byYear.map((y) => (
                        <tr key={y.year}><td>{y.year}</td><td>{money(y.principal)}</td><td>{money(y.interest)}</td><td>{money(y.balance)}</td></tr>
                      ))}</tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
            </>)}

            <div className="subcard" style={{ marginTop: 15 }}>
              <div className="sc-head"><span className="sc-title">Email <em>yourself</em> a copy</span></div>
              <div style={{ fontSize: 14, color: "var(--ink-soft)", fontWeight: 500, marginBottom: 12, lineHeight: 1.5 }}>Send this estimate to your inbox so you have your numbers handy.</div>
              <div className="addr-row">
                <input className="txt" type="email" value={email} placeholder="you@email.com"
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") sendEmail(); }} />
                <button className="ai-btn" onClick={sendEmail}>
                  <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg>
                  Email me a copy
                </button>
              </div>
            </div>

            <Disclaimer />
          </div>
        </div>
      </section>
    </div>
    </>
  );
}

/* ---- shared address AI estimator (used by Payment & Buyer) ---- */
function AddressEstimator({ deal, ai }) {
  return (
    <Field label="Property address" hint="Optional — we'll estimate local rates">
      <div className="addr-row">
        <input className="txt" value={ai.address} placeholder="123 Marina Bay Dr, Kemah, TX"
          onChange={(e) => ai.setAddress(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") ai.run(); }} />
        <button className="ai-btn" onClick={ai.run} disabled={ai.state.status === "loading"}>
          {ai.state.status === "loading" ? <span className="spin"></span> : <Spark />}Estimate
        </button>
      </div>
      {ai.state.status === "loading" && <div className="ai-note ok">{ai.state.msg}</div>}
      {ai.state.status !== "idle" && ai.state.status !== "loading" && (
        <div className={"ai-note " + (ai.state.status === "ok" ? "ok" : "err")}>{ai.state.msg}</div>
      )}
      <a className="har-link" href={HAR_SEARCH_URL} target="_blank" rel="noopener noreferrer">
        <IcPin /> Look up exact tax &amp; HOA on HAR
        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M7 17 17 7M9 7h8v8"/></svg>
      </a>
    </Field>
  );
}

function Disclaimer() {
  return (
    <div className="disc">
      <span className="star" style={{ color: "var(--royal)" }}><IcShield /></span>
      <span>Figures are estimates for planning only and are <b>not a loan commitment, pre-approval, or guarantee of terms</b>.
        PMI/MIP, fees, taxes, title, and insurance vary by lender, county, and property. Mortgage interest may be tax-deductible —
        this is not tax advice; consult a licensed lender and tax professional. The Bly Team · eXp Realty. Equal Housing Opportunity.</span>
    </div>
  );
}

function ContactBar({ cta, sub }) {
  return (
    <div className="contact-bar">
      <div className="ct-av">BT</div>
      <div className="ct-info">
        <div className="ct-name">The Bly Team</div>
        <div className="ct-sub">{sub}</div>
        <div className="ct-meta">
          <a href="tel:+18329325435">(832) 932-5435</a>
          <span className="ct-dot"></span>
          <a href="mailto:clientcare@agentbly.com">clientcare@agentbly.com</a>
          <span className="ct-dot"></span>
          <span>217 E Main St, League City, TX 77573</span>
        </div>
      </div>
      <div className="cta-row" style={{ flex: "none" }}>
        <a className="cta cta-primary" href="mailto:clientcare@agentbly.com?subject=Mortgage%20Calculator%20Inquiry" style={{ textDecoration: "none" }}>{cta}</a>
      </div>
    </div>
  );
}
window.BlyShared = { AddressEstimator, Disclaimer, ContactBar };

/* =========================================================
   APP — grouped tabs + shared deal state
   ========================================================= */
const GROUPS = [
  { key: "buyers", label: "Buyers", desc: "Payment & costs · Score", subs: [
    { key: "payment", label: "Payment & Costs", sub: "PITI + cash to close" },
    { key: "gooddeal", label: "Good Deal", sub: "Equity & risk" }
  ] },
  { key: "sellers", label: "Sellers", desc: "Net proceeds · Refi", subs: [
    { key: "seller", label: "Seller Net", sub: "Proceeds" },
    { key: "refi", label: "Refinance", sub: "New payment" }
  ] },
  { key: "rentbuy", label: "Rent vs. Buy", desc: "Breakeven", subs: [
    { key: "rentbuy", label: "Rent vs Buy", sub: "Breakeven" }
  ] },
  { key: "investors", label: "Investors", desc: "Rental ROI · Rehab", subs: [
    { key: "investor", label: "Investor", sub: "Rental ROI" },
    { key: "rehab", label: "Rehab Estimator", sub: "70% rule" }
  ] }
];

function Chevron() {
  return <svg className="tb-chev" width="13" height="13" viewBox="0 0 16 16" fill="none"><path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

/* ---- home screen icons ---- */
function IcHome() {
  return <svg viewBox="0 0 24 24" fill="none"><path d="M3 11l9-8 9 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /><path d="M5.5 9.5V20h13V9.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}
function IcKeyCard() {
  return <svg viewBox="0 0 24 24" fill="none"><circle cx="8" cy="8" r="4.5" stroke="currentColor" strokeWidth="2" /><path d="M11.5 11.5L20 20m-3.5-.5V16h-3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}
function IcTagCard() {
  return <svg viewBox="0 0 24 24" fill="none"><path d="M3 3h8l10 10-8 8L3 11V3z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" /><circle cx="8" cy="8" r="1.6" fill="currentColor" /></svg>;
}
function IcScaleCard() {
  return <svg viewBox="0 0 24 24" fill="none"><path d="M12 4v16M4 7h16M6 7l-3 6a3.2 3.2 0 006 0L6 7zm12 0l-3 6a3.2 3.2 0 006 0l-3-6z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}
function IcChartCard() {
  return <svg viewBox="0 0 24 24" fill="none"><path d="M4 20V4m0 16h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /><path d="M7.5 15.5l4-4.5 3 2.5 5-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

const HOME_CARDS = [
  { go: "payment", group: "Buyers", icon: IcKeyCard, q: "What will it really cost each month?", tools: [
    { k: "payment", n: "Monthly payment" }, { k: "payment", n: "Cash to close" }, { k: "gooddeal", n: "Good-deal score" }] },
  { go: "seller", group: "Sellers", icon: IcTagCard, q: "What will you walk away with?", tools: [
    { k: "seller", n: "Net proceeds" }, { k: "refi", n: "Refinance check" }] },
  { go: "rentbuy", group: "Rent vs. Buy", icon: IcScaleCard, q: "When does buying beat renting?", tools: [
    { k: "rentbuy", n: "Breakeven analysis" }] },
  { go: "investor", group: "Investors", icon: IcChartCard, q: "Does the deal pencil out?", tools: [
    { k: "investor", n: "Cash flow & ROI" }, { k: "rehab", n: "Rehab budget + 70% rule" }] }
];

function HomeScreen({ go }) {
  return (
    <section className="home">
      <div className="home-hero">
        <div className="hh-eye">Free tools · No sign-up · Houston &amp; the Gulf Coast</div>
        <h1 className="hh-title">Know your numbers <em>before</em> you sign.</h1>
        <p className="hh-sub">Real payment math, closing costs, equity forecasts, and deal scores — the same numbers we run for our clients, free to explore.</p>
      </div>
      <div className="home-cards">
        {HOME_CARDS.map((c) => {
          const Icon = c.icon;
          return (
            <div className="home-card" key={c.go} role="button" tabIndex={0}
              onClick={() => go(c.go)} onKeyDown={(e) => { if (e.key === "Enter") go(c.go); }}>
              <div className="hc-ic"><Icon /></div>
              <div className="hc-group">{c.group}</div>
              <div className="hc-q">{c.q}</div>
              <div className="hc-tools">
                {c.tools.map((tl) => (
                  <span className="hc-chip" key={tl.n} onClick={(e) => { e.stopPropagation(); go(tl.k); }}>{tl.n}</span>
                ))}
              </div>
              <div className="hc-go">Start →</div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function StickyCta() {
  return (
    <div className="sticky-cta">
      <div className="scta-text"><b>The Bly Team</b><span>Houston &amp; Gulf Coast</span></div>
      <a className="scta-call" href="tel:+18329325435">(832) 932-5435</a>
      <a className="scta-btn" href="mailto:clientcare@agentbly.com?subject=Get%20Pre-Approved">Get Pre-Approved</a>
    </div>
  );
}

function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [tab, setTab] = useState("payment");
  const [view, setView] = useState("home");
  const [openMenu, setOpenMenu] = useState(null);
  const goTool = (k) => { setTab(k); setView("tools"); window.scrollTo(0, 0); };

  useEffect(() => {
    if (!openMenu) return;
    const close = (e) => { if (!e.target.closest(".tab-group")) setOpenMenu(null); };
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [openMenu]);

  const [deal, setDeal] = useState({
    homePrice: 325000, product: "conventional", downPct: 5, termYears: 30,
    rate: "6.48", taxRate: "2.0", insurance: "2800", hoa: "0", bracket: 22, vaExempt: false, apprecRate: "3",
    arv: 325000, rehab: 0
  });
  const set = (patch) => setDeal((d) => ({ ...d, ...patch }));

  const [address, setAddress] = useState("");
  const [aiState, setAiState] = useState({ status: "idle", msg: "" });

  useEffect(() => { document.body.dataset.theme = t.theme; }, [t.theme]);
  useEffect(() => { document.documentElement.style.setProperty("--radius", t.radius + "px"); }, [t.radius]);

  async function runEstimate() {
    if (!address.trim()) { setAiState({ status: "err", msg: "Enter an address first." }); return; }
    setAiState({ status: "loading", msg: "Looking up local rates…" });
    try {
      const prompt =
        "You are a Texas real-estate cost estimator. For this property address, estimate the annual property tax RATE " +
        "(percent of market value, typical for that county/city incl. ISD + county + MUD where common) and a typical annual " +
        "homeowners insurance premium in US dollars (account for Gulf Coast windstorm exposure near Galveston/Kemah/Seabrook). " +
        'Respond with ONLY compact JSON, no prose: {"taxRate": number, "insurance": number, "area": "County, ST"}. Address: ' + address;
      const raw = await window.claude.complete(prompt);
      const match = raw.match(/\{[\s\S]*\}/);
      const data = JSON.parse(match ? match[0] : raw);
      const patch = {};
      if (typeof data.taxRate === "number") patch.taxRate = String(Number(data.taxRate.toFixed(3)));
      if (typeof data.insurance === "number") patch.insurance = String(Math.round(data.insurance));
      set(patch);
      setAiState({ status: "ok", msg: "Estimated for " + (data.area || "your area") + " — adjust as needed." });
    } catch (e) {
      setAiState({ status: "err", msg: "Couldn't estimate automatically — please enter values manually." });
    }
  }
  const ai = { address, setAddress, state: aiState, run: runEstimate };

  return (
    <div className="app-wrap">
      <header className="app-head">
        <div className="brand-lockup">
          <img className="logo" src={(window.__resources && window.__resources.blyLogo) || "assets/bly-logo-white.png"} alt="The Bly Team" />
          <div className="brand-div"></div>
          <div className="brand-exp"><span className="ex1">eXp Realty</span><span className="ex2">Houston · Gulf Coast</span></div>
        </div>
        <div className="head-titles">
          <div className="he-eye">Buyer &amp; Seller Tools</div>
          <div className="he-title">Mortgage <em>&amp;</em> Closing Calculator</div>
        </div>
      </header>

      {view === "home" && <HomeScreen go={goTool} />}

      {view === "tools" && <>
      <nav className="tab-nav">
        <button className="home-btn" onClick={() => setView("home")} title="Back to start"><IcHome /></button>
        {GROUPS.map((g) => {
          const active = g.subs.some((s) => s.key === tab);
          const current = g.subs.find((s) => s.key === tab);
          const multi = g.subs.length > 1;
          const open = openMenu === g.key;
          return (
            <div className="tab-group" key={g.key}>
              <button className={"tab-btn" + (active ? " active" : "") + (open ? " open" : "")}
                onClick={() => {
                  if (multi) { setOpenMenu(open ? null : g.key); }
                  else { setTab(g.subs[0].key); setOpenMenu(null); }
                }}>
                <span className="tb-label">{g.label}{multi && <Chevron />}</span>
                <span className="tb-sub">{active && multi && current ? current.label : g.desc}</span>
              </button>
              {multi && open && (
                <div className="tab-menu">
                  {g.subs.map((s) => (
                    <button key={s.key} className={"tab-menu-item" + (tab === s.key ? " active" : "")}
                      onClick={() => { setTab(s.key); setOpenMenu(null); }}>
                      <span className="tm-label">{s.label}</span>
                      <span className="tm-sub">{s.sub}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {tab === "payment" && <PaymentTool deal={deal} set={set} ai={ai} tweaks={t} />}
      {tab === "seller" && <window.SellerTool deal={deal} set={set} />}
      {tab === "rentbuy" && <window.RentBuyTool deal={deal} set={set} ai={ai} />}
      {tab === "gooddeal" && <window.GoodDealTool deal={deal} set={set} />}
      {tab === "refi" && <window.RefinanceTool deal={deal} set={set} />}
      {tab === "rehab" && <window.RehabTool deal={deal} set={set} goTab={setTab} />}
      {tab === "investor" && <window.InvestorTool deal={deal} set={set} ai={ai} />}

      <div className="meta-bar">
        <div className="meta-item"><div className="meta-ic"><IcPin /></div><div className="mt">Built for<b>Houston &amp; the Gulf Coast</b></div></div>
        <div className="meta-sep"></div>
        <div className="meta-item"><div className="meta-ic"><IcCal /></div><div className="mt">Rates &amp; taxes<b>Update anytime</b></div></div>
        <div className="meta-sep"></div>
        <div className="meta-item"><div className="meta-ic"><IcShield /></div><div className="mt">Estimates only<b>Not a commitment</b></div></div>
      </div>
      </>}

      <StickyCta />

      <TweaksPanel>
        <TweakSection label="Vibe" />
        <TweakRadio label="Theme" value={t.theme} options={["clean", "warm", "data"]} onChange={(v) => setTweak("theme", v)} />
        <TweakSlider label="Card corners" value={t.radius} min={4} max={26} unit="px" onChange={(v) => setTweak("radius", v)} />
        <TweakSection label="Payment sections" />
        <TweakToggle label="Tax-savings estimate" value={t.showSavings} onChange={(v) => setTweak("showSavings", v)} />
        <TweakToggle label="Amortization detail" value={t.showAmort} onChange={(v) => setTweak("showAmort", v)} />
      </TweaksPanel>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
