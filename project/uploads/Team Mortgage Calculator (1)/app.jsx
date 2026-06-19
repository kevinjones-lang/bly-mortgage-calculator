/* app.jsx — The Bly Team Buyer & Seller Calculator (tabbed shell + Payment tool) */
const { useState, useEffect, useMemo } = React;
const M = window.Mortgage;
const { Field, MoneyInput, NumInput, CostRow, YearSelect, IcCal, IcPin, IcShield, Chev, Spark } = window.BlyUI;

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
  const [selYear, setSelYear] = useState(5);
  const cfg = M.PRODUCTS[deal.product];

  useEffect(() => {
    if (!cfg.downOptions.includes(deal.downPct)) set({ downPct: cfg.defaultDown });
  }, [deal.product]); // eslint-disable-line

  const r = useMemo(() => M.calculate({
    homePrice: deal.homePrice, downPct: deal.downPct, product: deal.product, rate: deal.rate,
    termYears: deal.termYears, taxRatePct: deal.taxRate, insuranceAnnual: deal.insurance,
    hoaMonthly: deal.hoa, taxBracketPct: deal.bracket, vaExempt: deal.vaExempt
  }), [deal]);

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

  return (
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
            <div className={"seg cols-" + (cfg.downOptions.length >= 4 ? 4 : cfg.downOptions.length)}>
              {cfg.downOptions.map((d) => (
                <button key={d} className={"seg-btn" + (deal.downPct === d ? " active" : "")}
                  onClick={() => set({ downPct: d })}>{d}%<small>{money(deal.homePrice * d / 100)}</small></button>
              ))}
            </div>
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
          <div className="section-label">Taxes, <b>insurance &amp; dues</b></div>
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
                <div className="bracket-pick">
                  {BRACKETS.map((b) => (
                    <button key={b} className={"bp" + (deal.bracket === b ? " active" : "")} onClick={() => set({ bracket: b })}>{b}%</button>
                  ))}
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

            <Disclaimer />
          </div>
        </div>
        <ContactBar cta="Get Pre-Approved" sub="Ready to get pre-approved? Let's run your real numbers." />
      </section>
    </div>
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
  { key: "buyers", label: "Buyers", desc: "Payment · Costs · Score", subs: [
    { key: "payment", label: "Payment", sub: "Monthly PITI" },
    { key: "buyer", label: "Buyer Costs", sub: "Cash to close" },
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
    { k: "payment", n: "Monthly payment" }, { k: "buyer", n: "Cash to close" }, { k: "gooddeal", n: "Good-deal score" }] },
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
                  <span className="hc-chip" key={tl.k} onClick={(e) => { e.stopPropagation(); go(tl.k); }}>{tl.n}</span>
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
      {tab === "buyer" && <window.BuyerTool deal={deal} set={set} ai={ai} />}
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
