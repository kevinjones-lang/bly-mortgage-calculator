/* ============================================================
   The Bly Team — Mortgage math engine
   Pure functions, attached to window.Mortgage.
   All rates entered as percentages (e.g. 6.25 = 6.25%).
   Figures are industry-standard ESTIMATES, not quotes.
   ============================================================ */
(function () {
  "use strict";

  // ---- Loan product configuration -------------------------------------
  // PMI / MIP / funding-fee rules reflect common 2025-26 conventions.
  const PRODUCTS = {
    conventional: {
      key: "conventional",
      name: "Conventional",
      blurb: "Backed by Fannie Mae / Freddie Mac.",
      downOptions: [3, 5, 10, 20],
      defaultDown: 5,
      upfrontFeePct: 0,        // none
      financeUpfront: false,
      // Borrower-paid monthly PMI, annual % of loan, tiered by down payment.
      pmiRate: function (downPct) {
        if (downPct >= 20) return 0;
        if (downPct >= 15) return 0.0029;
        if (downPct >= 10) return 0.0035;
        if (downPct >= 5)  return 0.0055;
        return 0.0078; // 3% down
      },
      annualMIPct: 0,
      // Conventional PMI auto-terminates at 78% LTV of original value.
      miCancelLTV: 0.78,
      footnotes: function (downPct) {
        if (downPct >= 20) return ["No mortgage insurance with 20% or more down."];
        return ["PMI is estimated and varies with credit score.",
                "PMI automatically ends once the balance reaches 78% of the original price."];
      }
    },
    fha: {
      key: "fha",
      name: "FHA",
      blurb: "Government-insured, flexible credit.",
      downOptions: [3.5, 5, 10],
      defaultDown: 3.5,
      upfrontFeePct: 0.0175,   // UFMIP, financed into the loan
      financeUpfront: true,
      pmiRate: function () { return 0; },
      annualMIPct: 0.0055,     // annual MIP
      miCancelLTV: null,       // see footnotes
      footnotes: function (downPct) {
        var f = ["Upfront MIP of 1.75% is financed into the loan.",
                 "Annual MIP \u2248 0.55% is included in the payment."];
        if (downPct < 10) f.push("With less than 10% down, MIP lasts the life of the loan.");
        else f.push("With 10%+ down, MIP can be removed after 11 years.");
        return f;
      }
    },
    va: {
      key: "va",
      name: "VA",
      blurb: "For eligible veterans & service members.",
      downOptions: [0, 5, 10],
      defaultDown: 0,
      upfrontFeePct: 0.0215,   // funding fee, first use, 0% down (financed)
      financeUpfront: true,
      pmiRate: function () { return 0; },
      annualMIPct: 0,          // no monthly MI ever
      miCancelLTV: null,
      // Funding fee scales with down payment (first use).
      fundingFee: function (downPct) {
        if (downPct >= 10) return 0.0125;
        if (downPct >= 5)  return 0.015;
        return 0.0215;
      },
      footnotes: function () {
        return ["No monthly mortgage insurance \u2014 ever.",
                "VA funding fee is financed into the loan.",
                "Fee is waived for veterans with a service-connected disability."];
      }
    }
  };

  // ---- Core helpers ----------------------------------------------------
  function monthlyPI(principal, annualRatePct, termYears) {
    var n = termYears * 12;
    var r = annualRatePct / 100 / 12;
    if (principal <= 0) return 0;
    if (r === 0) return principal / n;
    var f = Math.pow(1 + r, n);
    return principal * (r * f) / (f - 1);
  }

  // Full amortization schedule. Optionally drops conventional PMI at cancel LTV.
  function amortize(loanAmount, annualRatePct, termYears) {
    var n = termYears * 12;
    var r = annualRatePct / 100 / 12;
    var pi = monthlyPI(loanAmount, annualRatePct, termYears);
    var bal = loanAmount;
    var months = [];
    for (var m = 1; m <= n; m++) {
      var interest = bal * r;
      var principal = Math.min(pi - interest, bal);
      bal = Math.max(0, bal - principal);
      months.push({ month: m, interest: interest, principal: principal, balance: bal });
    }
    return months;
  }

  function aggregateByYear(months) {
    var years = [];
    for (var i = 0; i < months.length; i++) {
      var y = Math.floor(i / 12);
      if (!years[y]) years[y] = { year: y + 1, interest: 0, principal: 0, balance: 0 };
      years[y].interest += months[i].interest;
      years[y].principal += months[i].principal;
      years[y].balance = months[i].balance;
    }
    return years;
  }

  // ---- The big one: full calculation ----------------------------------
  function calculate(input) {
    var homePrice      = num(input.homePrice);
    var downPct        = num(input.downPct);
    var productKey     = input.product || "conventional";
    var rate           = num(input.rate);
    var termYears      = num(input.termYears) || 30;
    var taxRatePct     = num(input.taxRatePct);          // annual % of home value
    var insuranceAnnual= num(input.insuranceAnnual);     // $/yr
    var hoaMonthly     = num(input.hoaMonthly);          // $/mo
    var taxBracketPct  = num(input.taxBracketPct);       // for savings estimate
    var vaExempt       = !!input.vaExempt;

    var cfg = PRODUCTS[productKey] || PRODUCTS.conventional;

    var downPayment = homePrice * (downPct / 100);
    var baseLoan = Math.max(0, homePrice - downPayment);

    // Upfront fee (UFMIP / VA funding fee / USDA guarantee) — financed in.
    var upfrontPct = cfg.upfrontFeePct || 0;
    if (cfg.fundingFee) upfrontPct = cfg.fundingFee(downPct);
    if (productKey === "va" && vaExempt) upfrontPct = 0;
    var upfrontFee = baseLoan * upfrontPct;
    var financedFee = cfg.financeUpfront ? upfrontFee : 0;
    var loanAmount = baseLoan + financedFee;

    var ltv = homePrice > 0 ? baseLoan / homePrice : 0;

    // Principal & interest
    var pi = monthlyPI(loanAmount, rate, termYears);

    // Mortgage insurance (monthly)
    var miMonthly = 0;
    var miType = null;
    if (productKey === "conventional") {
      var pmiR = cfg.pmiRate(downPct);
      miMonthly = pmiR * baseLoan / 12;
      if (miMonthly > 0) miType = "PMI";
    } else if (cfg.annualMIPct > 0) {
      miMonthly = cfg.annualMIPct * loanAmount / 12;
      miType = productKey === "fha" ? "MIP" : "Guarantee fee";
    }

    var taxMonthly = homePrice * (taxRatePct / 100) / 12;
    var insMonthly = insuranceAnnual / 12;

    var totalMonthly = pi + taxMonthly + insMonthly + miMonthly + hoaMonthly;

    // Amortization-derived figures
    var months = amortize(loanAmount, rate, termYears);
    var year1 = { interest: 0, principal: 0 };
    for (var i = 0; i < Math.min(12, months.length); i++) {
      year1.interest += months[i].interest;
      year1.principal += months[i].principal;
    }
    var byYear = aggregateByYear(months);
    var totalInterest = 0;
    for (var j = 0; j < months.length; j++) totalInterest += months[j].interest;

    // PMI cancellation month (conventional only)
    var pmiCancelMonth = null;
    if (productKey === "conventional" && miMonthly > 0 && cfg.miCancelLTV) {
      var target = homePrice * cfg.miCancelLTV;
      for (var k = 0; k < months.length; k++) {
        if (months[k].balance <= target) { pmiCancelMonth = k + 1; break; }
      }
    }

    // Tax savings: year-1 mortgage interest deduction at marginal bracket.
    var deductibleInterest = year1.interest;
    var estAnnualSavings = deductibleInterest * (taxBracketPct / 100);
    var estMonthlySavings = estAnnualSavings / 12;

    return {
      cfg: cfg,
      homePrice: homePrice,
      downPayment: downPayment,
      downPct: downPct,
      baseLoan: baseLoan,
      financedFee: financedFee,
      upfrontFee: upfrontFee,
      upfrontPct: upfrontPct,
      loanAmount: loanAmount,
      ltv: ltv,
      rate: rate,
      termYears: termYears,
      // Monthly breakdown (the "PITI" + extras)
      pi: pi,
      taxMonthly: taxMonthly,
      insMonthly: insMonthly,
      miMonthly: miMonthly,
      miType: miType,
      hoaMonthly: hoaMonthly,
      totalMonthly: totalMonthly,
      // Detail
      year1Interest: year1.interest,
      year1Principal: year1.principal,
      totalInterest: totalInterest,
      byYear: byYear,
      months: months,
      pmiCancelMonth: pmiCancelMonth,
      // Tax
      deductibleInterest: deductibleInterest,
      estAnnualSavings: estAnnualSavings,
      estMonthlySavings: estMonthlySavings,
      effectiveMonthly: totalMonthly - estMonthlySavings,
      footnotes: cfg.footnotes(downPct)
    };
  }

  function num(v) {
    if (typeof v === "number") return isFinite(v) ? v : 0;
    if (v == null) return 0;
    var n = parseFloat(String(v).replace(/[^0-9.\-]/g, ""));
    return isFinite(n) ? n : 0;
  }

  /* ============================================================
     TEXAS TITLE INSURANCE (state-promulgated Basic Premium Rate,
     set by the Texas Dept. of Insurance — a public regulated schedule).
     Owner's policy premium by purchase price.
     ============================================================ */
  function titlePolicy(amount) {
    amount = num(amount);
    if (amount <= 0) return 0;
    var p;
    if (amount <= 100000) {
      var a = Math.max(25000, amount);
      p = 328 + (a - 25000) * ((832 - 328) / (100000 - 25000));
    } else if (amount <= 1000000) {
      p = 832 + (amount - 100000) * 0.00527;
    } else if (amount <= 5000000) {
      p = 5575 + (amount - 1000000) * 0.00433;
    } else if (amount <= 15000000) {
      p = 22895 + (amount - 5000000) * 0.00357;
    } else {
      p = 58595 + (amount - 15000000) * 0.00254;
    }
    return Math.round(p);
  }

  /* ============================================================
     SELLER'S NET SHEET — estimated proceeds from a sale.
     ============================================================ */
  function sellerNet(inp) {
    var price = num(inp.salePrice);
    var payoff = num(inp.payoff);
    var commissionPct = num(inp.commissionPct);
    var taxRatePct = num(inp.taxRatePct);
    var monthsOwnedInYear = num(inp.monthsOwnedInYear); // seller's prorated share of annual taxes

    var commission = price * commissionPct / 100;
    var titleOwner = inp.payTitle === false ? 0 : titlePolicy(price);
    var escrowFee = num(inp.escrowFee);
    var survey = num(inp.survey);
    var hoaTransfer = num(inp.hoaTransfer);
    var warranty = num(inp.warranty);
    var docPrep = num(inp.docPrep);
    var recording = num(inp.recording);
    var concessions = num(inp.concessions);   // seller-paid buyer costs
    var other = num(inp.other);

    var annualTax = price * taxRatePct / 100;
    var taxProration = annualTax * (monthsOwnedInYear / 12); // TX taxes paid in arrears → seller credits buyer

    var items = [
      { label: "Agent commission", sub: commissionPct + "% of sale price", value: commission },
      { label: "Owner's title policy", sub: "TX promulgated rate", value: titleOwner },
      { label: "Property tax proration", sub: monthsOwnedInYear + " mo of " + pct(taxRatePct) + " owed", value: taxProration },
      { label: "Survey", sub: "", value: survey },
      { label: "Escrow / closing fee", sub: "", value: escrowFee },
      { label: "HOA transfer / resale cert", sub: "", value: hoaTransfer },
      { label: "Home warranty", sub: "buyer-requested", value: warranty },
      { label: "Doc prep / attorney", sub: "", value: docPrep },
      { label: "Recording & misc", sub: "", value: recording + other },
      { label: "Seller concessions", sub: "credits to buyer", value: concessions }
    ];
    var totalCosts = 0;
    for (var i = 0; i < items.length; i++) totalCosts += items[i].value;
    var net = price - payoff - totalCosts;
    return {
      price: price, payoff: payoff, items: items, commission: commission,
      titleOwner: titleOwner, taxProration: taxProration,
      totalCosts: totalCosts, net: net,
      netPct: price > 0 ? net / price : 0
    };
  }

  /* ============================================================
     BUYER'S CASH-TO-CLOSE — down payment + closing costs + prepaids.
     ============================================================ */
  function buyerClosing(inp) {
    var price = num(inp.homePrice);
    var downPct = num(inp.downPct);
    var rate = num(inp.rate);
    var taxRatePct = num(inp.taxRatePct);
    var insuranceAnnual = num(inp.insuranceAnnual);
    var originationPct = num(inp.originationPct);
    var prepaidInterestDays = num(inp.prepaidInterestDays);
    var taxEscrowMonths = num(inp.taxEscrowMonths);
    var insEscrowMonths = num(inp.insEscrowMonths);

    var down = price * downPct / 100;
    var loan = Math.max(0, price - down);

    // Loan / lender costs
    var origination = loan * originationPct / 100;
    var appraisal = num(inp.appraisal);
    var creditInspection = num(inp.creditInspection); // credit report + inspection bundle
    // Title & government
    var lenderTitle = inp.payLenderTitle === false ? 0 : 100; // TX simultaneous-issue lender policy
    var survey = num(inp.survey);
    var recording = num(inp.recording);
    var escrowFee = num(inp.escrowFee);
    // Prepaids & escrow reserves
    var perDiem = loan * (rate / 100) / 365;
    var prepaidInterest = perDiem * prepaidInterestDays;
    var prepaidInsurance = insuranceAnnual; // 1 yr paid at closing
    var taxReserve = (price * taxRatePct / 100) / 12 * taxEscrowMonths;
    var insReserve = insuranceAnnual / 12 * insEscrowMonths;

    var closingCosts = origination + appraisal + creditInspection + lenderTitle + survey + recording + escrowFee;
    var prepaids = prepaidInterest + prepaidInsurance + taxReserve + insReserve;
    // Seller concessions credit the buyer's settlement charges (not the down
    // payment); cap at the actual closing costs + prepaids per lending rules.
    var concessionsReq = num(inp.sellerConcessions);
    var concessions = Math.min(concessionsReq, closingCosts + prepaids);
    var cashToClose = down + closingCosts + prepaids - concessions;

    return {
      price: price, down: down, downPct: downPct, loan: loan,
      loanCosts: [
        { label: "Loan origination", sub: originationPct + "% of loan", value: origination },
        { label: "Appraisal", sub: "", value: appraisal },
        { label: "Credit report & inspection", sub: "", value: creditInspection }
      ],
      titleGov: [
        { label: "Lender's title policy", sub: "simultaneous issue", value: lenderTitle },
        { label: "Survey", sub: "", value: survey },
        { label: "Escrow / closing fee", sub: "", value: escrowFee },
        { label: "Recording & government", sub: "", value: recording }
      ],
      prepaidItems: [
        { label: "Prepaid interest", sub: prepaidInterestDays + " days @ " + money(perDiem, 2) + "/day", value: prepaidInterest },
        { label: "Homeowners insurance", sub: "12 months at closing", value: prepaidInsurance },
        { label: "Property-tax reserve", sub: taxEscrowMonths + " months escrow", value: taxReserve },
        { label: "Insurance reserve", sub: insEscrowMonths + " months escrow", value: insReserve }
      ],
      closingCosts: closingCosts, prepaids: prepaids,
      sellerConcessions: concessions, concessionsRequested: concessionsReq,
      concessionsCapped: concessionsReq > concessions,
      cashToClose: cashToClose
    };
  }

  /* ============================================================
     RENT vs BUY — multi-year cost comparison with breakeven.
     ============================================================ */
  function rentVsBuy(inp) {
    var price = num(inp.homePrice);
    var down = num(inp.downPayment);
    var term = num(inp.termYears) || 30;
    var rate = num(inp.rate);
    var taxRatePct = num(inp.taxRatePct);
    var insAnnual = num(inp.insuranceAnnual);
    var rent = num(inp.monthlyRent);
    var rentIns = num(inp.renterInsMonthly);
    var infl = num(inp.inflationPct) / 100;
    var pointsPct = num(inp.pointsPct);
    var origPct = num(inp.originationPct);
    var pmiPct = num(inp.pmiAnnualPct);
    var hoaMo = num(inp.hoaMonthly);
    var maintMo = num(inp.maintenanceMonthly);
    var incomeTax = num(inp.incomeTaxPct) / 100;
    var save = num(inp.savingsRatePct) / 100;
    var apprec = num(inp.appreciationPct) / 100;
    var stay = Math.max(1, Math.round(num(inp.stayYears)) || 5);
    var comm = num(inp.commissionPct) / 100;

    var loan = Math.max(0, price - down);
    var pi = monthlyPI(loan, rate, term);
    var months = amortize(loan, rate, term);
    var closing = loan * (pointsPct + origPct) / 100;
    var upfront = down + closing;
    var annualTax0 = price * taxRatePct / 100;

    var series = [];
    var cumBuyOut = upfront, cumRent = 0;
    var breakeven = null;
    var totalRent = 0, totalBuyCash = upfront, totalTaxSave = 0;

    for (var y = 1; y <= stay; y++) {
      var f = Math.pow(1 + infl, y - 1);
      var intY = 0, balEnd = months.length ? loan : 0;
      var startM = (y - 1) * 12;
      var piY = 0;
      for (var m = startM; m < y * 12 && m < months.length; m++) {
        intY += months[m].interest; balEnd = months[m].balance; piY += pi;
      }
      var taxY = annualTax0 * f, insY = insAnnual * f, hoaY = hoaMo * 12 * f, maintY = maintMo * 12 * f;
      var pmiY = (balEnd > 0.8 * price) ? pmiPct / 100 * loan : 0;
      var taxSaveY = (intY + taxY) * incomeTax;
      var buyOutY = piY + taxY + insY + hoaY + maintY + pmiY - taxSaveY;
      var rentY = (rent * 12 + rentIns * 12) * f;

      cumBuyOut += buyOutY; cumRent += rentY;
      totalRent += rentY; totalBuyCash += buyOutY; totalTaxSave += taxSaveY;

      var valueY = price * Math.pow(1 + apprec, y);
      var equityY = valueY - valueY * comm - balEnd;
      var buyNet = cumBuyOut - equityY;
      var investedFV = upfront * Math.pow(1 + save, y);
      var rentNet = cumRent - (investedFV - upfront);
      if (breakeven === null && buyNet <= rentNet) breakeven = y;
      series.push({ year: y, buyNet: buyNet, rentNet: rentNet, equity: equityY, value: valueY });
    }
    var last = series[series.length - 1];
    return {
      loan: loan, pi: pi, upfront: upfront, closing: closing, down: down, stay: stay,
      series: series, breakeven: breakeven,
      buyNet: last.buyNet, rentNet: last.rentNet,
      diff: last.rentNet - last.buyNet,          // positive ⇒ buying cheaper
      buyWins: last.buyNet <= last.rentNet,
      finalValue: last.value, finalEquity: last.equity,
      totalRent: totalRent, totalBuyCash: totalBuyCash, totalTaxSave: totalTaxSave
    };
  }

  /* ============================================================
     REFINANCE — new payment, savings vs current, break-even.
     ============================================================ */
  function refinance(inp) {
    var balance = num(inp.currentBalance);
    var cashOut = num(inp.cashOut);
    var rollIn = !!inp.rollInCosts;
    var rate = num(inp.newRate);
    var term = num(inp.newTermYears) || 30;
    var currentPayment = num(inp.currentPayment);  // current P&I
    var homeValue = num(inp.homeValue);
    var origPct = num(inp.originationPct);
    var appraisal = num(inp.appraisal);
    var recording = num(inp.recording);
    var escrowFee = num(inp.escrowFee);
    var reissue = inp.priorPolicy !== false; // reissue/refi rate credit

    // Base new loan before financed costs
    var baseLoan = balance + cashOut;
    // Costs that don't depend on final loan much
    var lenderTitleRefi = (reissue ? 0.5 : 1) * titlePolicy(baseLoan); // TX reissue ≈ ~half
    var fixedCosts = appraisal + recording + escrowFee + lenderTitleRefi;
    // origination depends on loan; if rolling in, iterate once
    var origination = baseLoan * origPct / 100;
    var closingCosts = origination + fixedCosts;
    var newLoan = rollIn ? baseLoan + closingCosts : baseLoan;
    if (rollIn) { // recompute origination on the larger loan once
      origination = newLoan * origPct / 100;
      closingCosts = origination + fixedCosts;
      newLoan = baseLoan + closingCosts;
    }

    var newPI = monthlyPI(newLoan, rate, term);
    var monthlySavings = currentPayment - newPI;
    var breakevenMonths = (monthlySavings > 0 && !rollIn)
      ? Math.ceil(closingCosts / monthlySavings)
      : (monthlySavings > 0 ? Math.ceil(closingCosts / monthlySavings) : null);
    var ltv = homeValue > 0 ? newLoan / homeValue : 0;

    return {
      baseLoan: baseLoan, newLoan: newLoan, cashOut: cashOut, newPI: newPI,
      currentPayment: currentPayment, monthlySavings: monthlySavings,
      annualSavings: monthlySavings * 12, breakevenMonths: breakevenMonths,
      ltv: ltv, rollIn: rollIn,
      costs: [
        { label: "Loan origination", sub: origPct + "% of loan", value: origination },
        { label: "Appraisal", sub: "", value: appraisal },
        { label: "Lender's title", sub: reissue ? "TX reissue / refi rate" : "full rate", value: lenderTitleRefi },
        { label: "Escrow / closing fee", sub: "", value: escrowFee },
        { label: "Recording & government", sub: "", value: recording }
      ],
      closingCosts: closingCosts
    };
  }

  /* ============================================================
     INVESTOR — rental analysis: cash flow, CoC, cap rate, 70% rule.
     ============================================================ */
  function investor(inp) {
    var purchase = num(inp.purchasePrice);
    var rehab = num(inp.rehab);
    var arv = num(inp.arv) || purchase;
    var closing = num(inp.closingCosts);
    var downPct = num(inp.downPct);
    var rate = num(inp.rate);
    var term = num(inp.termYears) || 30;
    var pointsPct = num(inp.pointsPct);
    var rent = num(inp.monthlyRent);
    var taxRatePct = num(inp.taxRatePct);
    var insAnnual = num(inp.insuranceAnnual);
    var vacancyPct = num(inp.vacancyPct);
    var mgmtPct = num(inp.mgmtPct);
    var repairsPct = num(inp.repairsPct);
    var capexPct = num(inp.capexPct);
    var hoaMonthly = num(inp.hoaMonthly);
    var utilitiesMonthly = num(inp.utilitiesMonthly);
    var cashPurchase = !!inp.cashPurchase;

    var down = cashPurchase ? purchase : purchase * downPct / 100;
    var loan = cashPurchase ? 0 : Math.max(0, purchase - down);
    var pi = loan > 0 ? monthlyPI(loan, rate, term) : 0;
    var points = loan * pointsPct / 100;

    var taxMonthly = purchase * taxRatePct / 100 / 12;
    var insMonthly = insAnnual / 12;
    var vacancy = rent * vacancyPct / 100;
    var mgmt = rent * mgmtPct / 100;
    var repairs = rent * repairsPct / 100;
    var capex = rent * capexPct / 100;
    var opExMonthly = taxMonthly + insMonthly + vacancy + mgmt + repairs + capex + hoaMonthly + utilitiesMonthly;

    var cashFlowMonthly = rent - opExMonthly - pi;
    var cashInvested = down + closing + rehab + points;
    var coc = cashInvested > 0 ? (cashFlowMonthly * 12) / cashInvested : 0;

    // NOI excludes debt service & capex; cap rate on all-in basis
    var egi = rent * 12 * (1 - vacancyPct / 100);
    var operating = (taxMonthly + insMonthly + mgmt + repairs + hoaMonthly + utilitiesMonthly) * 12;
    var noi = egi - operating;
    var allIn = purchase + rehab;
    var capRate = allIn > 0 ? noi / allIn : 0;

    var maxOffer = 0.7 * arv - rehab;        // 70% rule max purchase
    var meets70 = (purchase + rehab) <= 0.7 * arv;
    var onePctTarget = purchase * 0.01;
    var meets1 = rent >= onePctTarget;

    return {
      purchase: purchase, rehab: rehab, arv: arv, allIn: allIn, down: down, loan: loan, pi: pi,
      rent: rent, opExMonthly: opExMonthly, cashFlowMonthly: cashFlowMonthly,
      cashInvested: cashInvested, coc: coc, noi: noi, capRate: capRate,
      maxOffer: maxOffer, meets70: meets70, onePctTarget: onePctTarget, meets1: meets1,
      breakdown: {
        taxMonthly: taxMonthly, insMonthly: insMonthly, vacancy: vacancy, mgmt: mgmt,
        repairs: repairs, capex: capex, hoa: hoaMonthly, utilities: utilitiesMonthly, pi: pi
      }
    };
  }

  /* ============================================================
     EQUITY / HOME-VALUE PROJECTION
     Greater Houston (FHFA All-Transactions HPI, Houston MSA):
     ~4.67%/yr compounded over the last 30 years (1996Q1 104.30 → 2026Q1 410.73).
     ============================================================ */
  function equityProjection(inp) {
    var homePrice = num(inp.homePrice);
    var downPct = num(inp.downPct);
    var apprec = num(inp.apprecRate) / 100;
    var maxYears = num(inp.maxYears) || 40;

    var base = calculate({
      homePrice: homePrice, downPct: downPct, product: inp.product, rate: inp.rate,
      termYears: inp.termYears, taxRatePct: 0, insuranceAnnual: 0, hoaMonthly: 0,
      taxBracketPct: 0, vaExempt: inp.vaExempt
    });

    var rows = [];
    for (var y = 0; y <= maxYears; y++) {
      var value = homePrice * Math.pow(1 + apprec, y);
      var balance;
      if (y === 0) balance = base.loanAmount;
      else if (y <= base.byYear.length) balance = base.byYear[y - 1].balance;
      else balance = 0;
      rows.push({
        year: y,
        value: value,
        balance: balance,
        equity: value - balance,
        fromAppreciation: value - homePrice,
        fromPaydown: base.loanAmount - balance
      });
    }
    return {
      rows: rows, down: base.downPayment, loanAmount: base.loanAmount,
      term: base.termYears, homePrice: homePrice, maxYears: maxYears,
      apprecPct: num(inp.apprecRate)
    };
  }

  /* ============================================================
     STANDARD DEDUCTIONS (2025 tax year) by filing status, and the
     SALT cap (raised to $40,000 for 2025 under current law; editable).
     ============================================================ */
  var STD_DEDUCTION = { single: 15000, mfj: 30000, mfs: 15000, hoh: 22500 };

  /* TAX BENEFIT REALITY CHECK — itemizing only helps beyond the
     standard deduction. Returns the incremental benefit, if any. */
  function taxReality(inp) {
    var interest = num(inp.interest);
    var propTax = num(inp.propTax);
    var other = num(inp.otherItemized);
    var points = num(inp.points);
    var pmi = num(inp.pmi);
    var rate = num(inp.marginalPct) / 100;
    var saltCap = inp.saltCap == null ? 40000 : num(inp.saltCap);
    var std = inp.standardDeduction != null ? num(inp.standardDeduction)
      : (STD_DEDUCTION[inp.filing] || STD_DEDUCTION.mfj);

    var deductibleSalt = Math.min(propTax, saltCap);  // property tax counts toward SALT
    var potential = interest + deductibleSalt + other + points + pmi;
    var incremental = Math.max(0, potential - std);
    var savings = incremental * rate;
    return {
      interest: interest, deductibleSalt: deductibleSalt, saltCap: saltCap,
      other: other, points: points, pmi: pmi,
      potential: potential, standardDeduction: std, incremental: incremental,
      itemizes: potential > std, marginalPct: num(inp.marginalPct),
      annualSavings: savings, monthlySavings: savings / 12
    };
  }

  /* TRUE MONTHLY COST — PITI plus the real ownership line items,
     minus the estimated monthly tax benefit. */
  function trueMonthlyCost(inp) {
    var piti = num(inp.piti);            // P+I+tax+ins+mi (no HOA)
    var hoa = num(inp.hoa);
    var maint = num(inp.maintenance);
    var utilities = num(inp.utilities);
    var lawn = num(inp.lawn);
    var pool = num(inp.pool);
    var flood = num(inp.floodAnnual) / 12;
    var wind = num(inp.windAnnual) / 12;
    var benefit = num(inp.taxBenefitMonthly);
    var items = [
      { label: "Principal, interest, tax & insurance", value: piti },
      { label: "HOA dues", value: hoa },
      { label: "Maintenance reserve", value: maint },
      { label: "Utilities", value: utilities },
      { label: "Lawn / pool care", value: lawn + pool },
      { label: "Flood / windstorm insurance", value: flood + wind }
    ];
    var gross = 0;
    for (var i = 0; i < items.length; i++) gross += items[i].value;
    return { items: items, gross: gross, taxBenefit: benefit, trueMonthly: gross - benefit };
  }

  /* COST OF WAITING — rent burned, appreciation missed, larger down
     payment required, and the higher monthly payment if rates rise. */
  function costOfWaiting(inp) {
    var months = num(inp.waitMonths) || 12;
    var rent = num(inp.rent);
    var apprec = num(inp.apprecPct) / 100;
    var price = num(inp.homePrice);
    var rateNow = num(inp.rateNow);
    var rateFuture = num(inp.rateFuture);
    var downPct = num(inp.downPct);
    var term = num(inp.termYears) || 30;

    var yrs = months / 12;
    var rentPaid = rent * months;
    var futurePrice = price * Math.pow(1 + apprec, yrs);
    var missedApprec = futurePrice - price;
    var addedDown = missedApprec * downPct / 100;

    var loanNow = price * (1 - downPct / 100);
    var loanFut = futurePrice * (1 - downPct / 100);
    var piNow = monthlyPI(loanNow, rateNow, term);
    var piFut = monthlyPI(loanFut, rateFuture, term);
    var pmtDiffMonthly = piFut - piNow;
    var pmtDiffYear = Math.max(0, pmtDiffMonthly) * 12;

    var total = rentPaid + missedApprec + addedDown + pmtDiffYear;
    return {
      months: months, rentPaid: rentPaid, futurePrice: futurePrice,
      missedApprec: missedApprec, addedDown: addedDown,
      pmtDiffMonthly: pmtDiffMonthly, pmtDiffYear: pmtDiffYear,
      piNow: piNow, piFut: piFut, total: total
    };
  }

  /* WEALTH BUILT — gross & net equity created by ownership year N,
     decomposed into loan paydown vs appreciation. */
  function wealthBuilt(proj, year, sellCostPct) {
    var rows = proj.rows;
    var row = rows[Math.min(year, rows.length - 1)];
    var paydown = row.fromPaydown;
    var apprecGain = row.fromAppreciation;
    var grossEquity = paydown + apprecGain;        // equity created beyond the down payment
    var sellingCosts = row.value * (num(sellCostPct) / 100);
    var netEquity = row.equity - sellingCosts;     // total stake you'd walk away with
    return {
      year: year, value: row.value, balance: row.balance,
      paydown: paydown, apprecGain: apprecGain, grossEquity: grossEquity,
      sellingCosts: sellingCosts, netEquity: netEquity, totalEquity: row.equity
    };
  }

  function clamp(x, a, b) { return Math.max(a, Math.min(b, x)); }

  /* GOOD DEAL SCORE — weighted 0-100 buyer-confidence composite.
     Missing optional inputs (income, cash reserves) are renormalized
     out so the score reflects only what the buyer has provided. */
  function goodDealScore(inp) {
    var weights = {
      affordability: 0.25, cashComfort: 0.15, equityGrowth: 0.25,
      rentVsBuy: 0.15, risk: 0.10, tax: 0.10
    };
    var parts = {};

    // Affordability — housing ratio (PITI / gross monthly income)
    var income = num(inp.monthlyIncome);
    if (income > 0) {
      var ratio = num(inp.piti) / income;
      parts.affordability = { score: clamp((0.45 - ratio) / (0.45 - 0.28), 0, 1),
        note: pct(ratio * 100, 0) + " of income to housing" };
    }
    // Cash-to-close comfort — reserves vs cash needed
    var cash = num(inp.cashAvailable);
    var ctc = num(inp.cashToClose);
    if (cash > 0 && ctc > 0) {
      parts.cashComfort = { score: clamp((cash / ctc - 1) / 0.5, 0, 1),
        note: (cash >= ctc ? "+" : "") + money(cash - ctc) + " vs cash to close" };
    }
    // Equity growth — net proceeds at horizon vs cash invested
    var cashInvested = num(inp.cashInvested);
    var netEquity = num(inp.netEquityHorizon);
    if (cashInvested > 0) {
      var mult = netEquity / cashInvested;
      parts.equityGrowth = { score: clamp((mult - 0.8) / (1.8 - 0.8), 0, 1),
        note: mult.toFixed(1) + "× cash invested by year " + num(inp.horizon) };
    }
    // Rent vs buy — breakeven year within the ownership horizon
    var be = inp.breakeven, T = num(inp.horizon) || 5;
    if (be != null) {
      parts.rentVsBuy = { score: clamp((T - be) / (T * 0.6), 0, 1),
        note: "Breakeven year " + be + " vs " + T + "-yr plan" };
    } else if (inp.breakeven === null) {
      parts.rentVsBuy = { score: 0.15, note: "No breakeven within " + T + " yrs" };
    }
    // Risk — start clean, subtract for property flags
    var rk = 1;
    if (inp.flood === "high") rk -= 0.4; else if (inp.flood === "moderate") rk -= 0.2;
    if (inp.windNeeded) rk -= 0.15;
    if (num(inp.roofAge) > 20) rk -= 0.2; else if (num(inp.roofAge) > 15) rk -= 0.1;
    if (num(inp.hvacAge) > 15) rk -= 0.15;
    if (inp.foundation) rk -= 0.25;
    if (inp.reassessRisk === "high") rk -= 0.15;
    parts.risk = { score: clamp(rk, 0, 1), note: "Property & insurance exposure" };
    // Tax — incremental itemized benefit relative to standard deduction
    var incr = num(inp.taxIncremental), std = num(inp.standardDeduction) || 30000;
    parts.tax = { score: clamp(incr / (std * 0.5), 0, 1),
      note: incr > 0 ? money(num(inp.taxAnnualSavings)) + " est. annual benefit" : "Standard deduction wins" };

    // Weighted sum, renormalized over the categories we could score
    var totalW = 0, acc = 0, breakdown = [];
    var labels = {
      affordability: "Monthly affordability", cashComfort: "Cash-to-close comfort",
      equityGrowth: "Equity growth potential", rentVsBuy: "Rent vs. buy advantage",
      risk: "Resale / condition risk", tax: "Tax benefit"
    };
    Object.keys(weights).forEach(function (k) {
      var w = weights[k], p = parts[k];
      var has = !!p;
      if (has) { totalW += w; acc += w * p.score; }
      breakdown.push({
        key: k, label: labels[k], weight: w, has: has,
        score: has ? p.score : null, note: has ? p.note : "Add inputs to score",
        points: has ? Math.round(p.score * w * 100) : null
      });
    });
    var score = totalW > 0 ? Math.round(acc / totalW * 100) : 0;
    var rating, band;
    if (score >= 85) { rating = "Strong Buy"; band = "strong"; }
    else if (score >= 70) { rating = "Good Opportunity"; band = "good"; }
    else if (score >= 55) { rating = "Fair / Review Carefully"; band = "fair"; }
    else { rating = "Caution"; band = "caution"; }
    return { score: score, rating: rating, band: band, breakdown: breakdown };
  }

  // ---- Formatters ------------------------------------------------------
  function money(v, dp) {
    if (dp == null) dp = 0;
    if (!isFinite(v)) v = 0;
    return "$" + v.toLocaleString("en-US", { minimumFractionDigits: dp, maximumFractionDigits: dp });
  }
  function pct(v, dp) {
    if (dp == null) dp = 2;
    return (isFinite(v) ? v : 0).toFixed(dp) + "%";
  }

  window.Mortgage = {
    PRODUCTS: PRODUCTS,
    calculate: calculate,
    amortize: amortize,
    monthlyPI: monthlyPI,
    titlePolicy: titlePolicy,
    sellerNet: sellerNet,
    buyerClosing: buyerClosing,
    rentVsBuy: rentVsBuy,
    refinance: refinance,
    investor: investor,
    equityProjection: equityProjection,
    taxReality: taxReality,
    trueMonthlyCost: trueMonthlyCost,
    costOfWaiting: costOfWaiting,
    wealthBuilt: wealthBuilt,
    goodDealScore: goodDealScore,
    STD_DEDUCTION: STD_DEDUCTION,
    money: money,
    pct: pct,
    num: num
  };
})();
