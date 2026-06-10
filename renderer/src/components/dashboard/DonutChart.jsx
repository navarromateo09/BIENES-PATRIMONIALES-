export default function DonutChart({ slices = [], total = 0, size = 140 }) {
  const r = 42;
  const cx = size / 2;
  const cy = size / 2;
  const circ = 2 * Math.PI * r;
  const sum = slices.reduce((s, x) => s + x.value, 0) || 1;
  let offset = 0;

  return (
    <div className="dash-donut-wrap">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="dash-donut">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#eef1f6" strokeWidth="14" />
        {slices.map((slice, i) => {
          const pct = slice.value / sum;
          const dash = pct * circ;
          const el = (
            <circle
              key={i}
              cx={cx}
              cy={cy}
              r={r}
              fill="none"
              stroke={slice.color}
              strokeWidth="14"
              strokeDasharray={`${dash} ${circ - dash}`}
              strokeDashoffset={-offset}
              transform={`rotate(-90 ${cx} ${cy})`}
            />
          );
          offset += dash;
          return el;
        })}
        <text x={cx} y={cy - 4} textAnchor="middle" className="dash-donut-total">{total}</text>
        <text x={cx} y={cy + 14} textAnchor="middle" className="dash-donut-label">Total</text>
      </svg>
      <ul className="dash-donut-legend">
        {slices.map((s, i) => (
          <li key={i}>
            <span className="dash-legend-dot" style={{ background: s.color }} />
            <span>{s.label}</span>
            <strong>{s.value}</strong>
          </li>
        ))}
      </ul>
    </div>
  );
}
