/* charts.jsx — lightweight SVG visualizations for the calculator.
   Exposes window.PitiBar and window.AmortChart. */

// Horizontal stacked bar for the PITI breakdown.
function PitiBar({ segments }) {
  const total = segments.reduce((s, x) => s + Math.max(0, x.value), 0) || 1;
  return (
    <div className="piti-bar" role="img" aria-label="Monthly payment breakdown">
      {segments.map((s, i) =>
        s.value > 0 ? (
          <div
            key={i}
            className="piti-seg"
            style={{ width: (s.value / total) * 100 + "%", background: s.color }}
            title={`${s.label}: ${window.Mortgage.money(s.value)}`}
          />
        ) : null
      )}
    </div>
  );
}

// Stacked yearly principal-vs-interest area/bar chart over the loan life.
function AmortChart({ byYear, height = 168 }) {
  if (!byYear || !byYear.length) return null;
  const W = 560, H = height, padL = 4, padR = 4, padB = 22, padT = 6;
  const innerW = W - padL - padR;
  const innerH = H - padB - padT;
  const n = byYear.length;
  const maxPay = Math.max(...byYear.map((y) => y.interest + y.principal)) || 1;
  const barGap = n > 20 ? 1.5 : 3;
  const bw = (innerW - barGap * (n - 1)) / n;

  // Find PMI/crossover year where principal first exceeds interest.
  let crossYear = null;
  for (let i = 0; i < n; i++) {
    if (byYear[i].principal > byYear[i].interest) { crossYear = i; break; }
  }

  return (
    <svg className="amort-svg" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none"
         role="img" aria-label="Principal versus interest over the life of the loan">
      {byYear.map((y, i) => {
        const x = padL + i * (bw + barGap);
        const totH = ((y.interest + y.principal) / maxPay) * innerH;
        const intH = (y.interest / maxPay) * innerH;
        const priH = totH - intH;
        const yTop = padT + (innerH - totH);
        return (
          <g key={i}>
            <rect x={x} y={yTop} width={Math.max(0.5, bw)} height={intH}
                  fill="var(--seg-interest)" rx="1" />
            <rect x={x} y={yTop + intH} width={Math.max(0.5, bw)} height={priH}
                  fill="var(--seg-pi)" rx="1" />
          </g>
        );
      })}
      {/* x-axis year ticks */}
      {byYear.map((y, i) => {
        const show = n <= 15 ? i % 5 === 4 || i === 0 : (i + 1) % 5 === 0;
        if (!show && i !== 0 && i !== n - 1) return null;
        const x = padL + i * (bw + barGap) + bw / 2;
        return (
          <text key={"t" + i} x={x} y={H - 6} className="amort-tick"
                textAnchor="middle">{i === 0 ? "Yr 1" : "Yr " + (i + 1)}</text>
        );
      })}
    </svg>
  );
}

window.PitiBar = PitiBar;
window.AmortChart = AmortChart;

// Two-line comparison (rent vs buy net cost) with breakeven marker.
function RentBuyChart({ series, breakeven, height = 196 }) {
  if (!series || !series.length) return null;
  const W = 560, H = height, padL = 6, padR = 6, padB = 24, padT = 10;
  const innerW = W - padL - padR, innerH = H - padB - padT;
  const n = series.length;
  const vals = series.flatMap((s) => [s.buyNet, s.rentNet]);
  let lo = Math.min(...vals, 0), hi = Math.max(...vals, 0);
  const pad = (hi - lo) * 0.08 || 1; lo -= pad; hi += pad;
  const x = (i) => padL + (n === 1 ? innerW / 2 : (i / (n - 1)) * innerW);
  const yv = (v) => padT + innerH - ((v - lo) / (hi - lo)) * innerH;
  const line = (key) => series.map((s, i) => (i ? "L" : "M") + x(i).toFixed(1) + " " + yv(s[key]).toFixed(1)).join(" ");
  const zeroY = yv(0);
  return (
    <svg className="amort-svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Rent versus buy net cost over time">
      {lo < 0 && hi > 0 && <line x1={padL} y1={zeroY} x2={W - padR} y2={zeroY} stroke="var(--line-strong)" strokeWidth="1" strokeDasharray="3 3" />}
      <path d={line("rentNet")} fill="none" stroke="var(--seg-tax)" strokeWidth="2.5" strokeLinejoin="round" />
      <path d={line("buyNet")} fill="none" stroke="var(--seg-savings)" strokeWidth="2.5" strokeLinejoin="round" />
      {breakeven && (
        <g>
          <line x1={x(breakeven - 1)} y1={padT} x2={x(breakeven - 1)} y2={padT + innerH} stroke="var(--ink-faint)" strokeWidth="1" strokeDasharray="2 3" />
          <circle cx={x(breakeven - 1)} cy={yv(series[breakeven - 1].buyNet)} r="3.5" fill="var(--seg-savings)" />
        </g>
      )}
      {series.map((s, i) => {
        const show = n <= 12 ? true : (i % Math.ceil(n / 10) === 0 || i === n - 1);
        if (!show) return null;
        return <text key={i} x={x(i)} y={H - 7} className="amort-tick" textAnchor="middle">{"Yr " + s.year}</text>;
      })}
    </svg>
  );
}
window.RentBuyChart = RentBuyChart;

// Stacked area: home value (top) vs loan balance, equity = the shaded gap.
// Vertical marker at the selected year.
function EquityChart({ rows, selYear, height = 200 }) {
  if (!rows || !rows.length) return null;
  const W = 560, H = height, padL = 6, padR = 6, padB = 24, padT = 10;
  const innerW = W - padL - padR, innerH = H - padB - padT;
  const n = rows.length;
  const hi = Math.max(...rows.map((r) => r.value)) || 1;
  const x = (i) => padL + (n === 1 ? innerW / 2 : (i / (n - 1)) * innerW);
  const y = (v) => padT + innerH - (v / hi) * innerH;
  const valLine = rows.map((r, i) => (i ? "L" : "M") + x(i).toFixed(1) + " " + y(r.value).toFixed(1)).join(" ");
  const balLine = rows.map((r, i) => (i ? "L" : "M") + x(i).toFixed(1) + " " + y(r.balance).toFixed(1)).join(" ");
  // equity area = between value line (top) and balance line (bottom)
  const equityArea = valLine + " " + rows.slice().reverse().map((r, j) => "L" + x(n - 1 - j).toFixed(1) + " " + y(r.balance).toFixed(1)).join(" ") + " Z";
  const selIdx = Math.max(0, Math.min(n - 1, selYear));
  return (
    <svg className="amort-svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Home value, loan balance and equity over time">
      <path d={equityArea} fill="var(--seg-savings)" opacity="0.16" />
      <path d={balLine} fill="none" stroke="var(--seg-interest)" strokeWidth="2.5" strokeLinejoin="round" />
      <path d={valLine} fill="none" stroke="var(--seg-pi)" strokeWidth="2.5" strokeLinejoin="round" />
      <g>
        <line x1={x(selIdx)} y1={padT} x2={x(selIdx)} y2={padT + innerH} stroke="var(--royal)" strokeWidth="1.5" strokeDasharray="3 3" />
        <circle cx={x(selIdx)} cy={y(rows[selIdx].value)} r="4" fill="var(--seg-pi)" />
        <circle cx={x(selIdx)} cy={y(rows[selIdx].balance)} r="4" fill="var(--seg-interest)" />
      </g>
      {rows.map((r, i) => {
        const show = (i % Math.ceil(n / 8) === 0 || i === n - 1);
        if (!show) return null;
        return <text key={i} x={x(i)} y={H - 7} className="amort-tick" textAnchor="middle">{r.year === 0 ? "Now" : "Yr " + r.year}</text>;
      })}
    </svg>
  );
}
window.EquityChart = EquityChart;

// Semicircular score gauge (0-100) with band color.
function ScoreGauge({ score, band, size = 232 }) {
  const R = 96, sw = 19, cx = size / 2, cy = size / 2;
  const len = Math.PI * R;
  const colors = { strong: "#1d8a5b", good: "#2f9e6b", fair: "#c79a3e", caution: "#c0492f" };
  const col = colors[band] || "#1f60aa";
  const d = `M ${cx - R} ${cy} A ${R} ${R} 0 0 1 ${cx + R} ${cy}`;
  const frac = Math.max(0, Math.min(1, score / 100));
  return (
    <svg viewBox={`0 0 ${size} ${cy + 6}`} width="100%" style={{ maxWidth: size, display: "block" }}>
      <path d={d} fill="none" stroke="rgba(255,255,255,.18)" strokeWidth={sw} strokeLinecap="round" />
      <path d={d} fill="none" stroke={col} strokeWidth={sw} strokeLinecap="round"
        strokeDasharray={`${frac * len} ${len}`} style={{ transition: "stroke-dasharray .6s cubic-bezier(.4,0,.2,1)" }} />
    </svg>
  );
}
window.ScoreGauge = ScoreGauge;
