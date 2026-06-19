/* shared.jsx — UI primitives + icons shared across all three tools.
   Exposed via window.BlyUI. */
(function () {
  const { useState } = React;
  const M = window.Mortgage;

  function Field({ label, hint, children }) {
    return (
      <div className="field">
        {label && (
          <div className="field-label"><span>{label}</span>{hint && <span className="field-hint">{hint}</span>}</div>
        )}
        {children}
      </div>
    );
  }

  // Comma-formatted dollar input bound to a numeric value ("" allowed).
  function MoneyInput({ value, onChange, placeholder }) {
    const display = value === "" || value == null ? "" : Number(value).toLocaleString("en-US");
    return (
      <div className="input-money">
        <span className="dollar">$</span>
        <input className="txt has-dollar" inputMode="numeric" value={display} placeholder={placeholder}
          onChange={(e) => {
            const digits = e.target.value.replace(/[^0-9]/g, "");
            onChange(digits === "" ? "" : parseInt(digits, 10));
          }} />
      </div>
    );
  }

  // Free-text numeric input (decimals ok) with optional suffix.
  function NumInput({ value, onChange, suffix, placeholder }) {
    return (
      <div className="suffix-input">
        <input className="txt" inputMode="decimal" value={value} placeholder={placeholder}
          onChange={(e) => onChange(e.target.value.replace(/[^0-9.]/g, ""))} />
        {suffix && <span className="suffix">{suffix}</span>}
      </div>
    );
  }

  const IcCal = () => (<svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8" strokeLinecap="round"><rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M3.5 9.5h17M8 3v4M16 3v4"/></svg>);
  const IcPin = () => (<svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 21s7-6.4 7-11a7 7 0 1 0-14 0c0 4.6 7 11 7 11Z"/><circle cx="12" cy="10" r="2.5"/></svg>);
  const IcShield = () => (<svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8" strokeLinejoin="round"><path d="M12 3l7 2.5v6c0 4.5-3.1 7.7-7 9-3.9-1.3-7-4.5-7-9v-6L12 3Z"/><path d="M12 8.2l1 2.1 2.3.2-1.7 1.6.5 2.3-2.1-1.2-2.1 1.2.5-2.3-1.7-1.6 2.3-.2 1-2.1Z" fill="currentColor" stroke="none"/></svg>);
  const Chev = () => (<svg className="chev" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M6 9l6 6 6-6"/></svg>);
  const Spark = () => (<svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor"><path d="M12 2l1.6 5.4L19 9l-5.4 1.6L12 16l-1.6-5.4L5 9l5.4-1.6L12 2Z"/></svg>);

  // Simple itemized cost row.
  function CostRow({ label, sub, value, strong }) {
    return (
      <div className={"cost-row" + (strong ? " strong" : "")}>
        <span className="cost-name">{label}{sub && <small>{sub}</small>}</span>
        <span className="cost-val">{M.money(value)}</span>
      </div>
    );
  }

  // Prominent "see any year of your loan" control.
  function YearSelect({ value, max, onChange }) {
    return (
      <label className="year-select">
        <span className="ys-cal"><IcCal /></span>
        <span className="ys-lab">Loan year</span>
        <span className="ys-pick">
          <select value={value} onChange={(e) => onChange(parseInt(e.target.value, 10))}>
            {Array.from({ length: max }, (_, i) => i + 1).map((y) => (
              <option key={y} value={y}>Year {y} of {max}</option>
            ))}
          </select>
        </span>
      </label>
    );
  }

  window.BlyUI = { Field, MoneyInput, NumInput, CostRow, YearSelect, IcCal, IcPin, IcShield, Chev, Spark };
})();
