export default function BarChart({ labels = [], series = [] }) {
  const max = Math.max(1, ...series.flatMap((s) => s.values));
  const n = labels.length || 1;

  return (
    <div className="dash-bar-chart">
      <div className="dash-bar-legend">
        {series.map((s) => (
          <span key={s.name} className="dash-bar-legend-item">
            <span className="dash-legend-dot" style={{ background: s.color }} />
            {s.name}
          </span>
        ))}
      </div>
      <div className="dash-bar-grid" style={{ gridTemplateColumns: `repeat(${n}, 1fr)` }}>
        {labels.map((label, i) => (
          <div key={i} className="dash-bar-col">
            <div className="dash-bar-stack">
              {series.map((s) => {
                const v = s.values[i] || 0;
                const h = v > 0 ? Math.max(8, (v / max) * 100) : 0;
                return v > 0 ? (
                  <div
                    key={s.name}
                    className="dash-bar-segment"
                    style={{ height: `${h}%`, background: s.color }}
                    title={`${s.name}: ${v}`}
                  />
                ) : null;
              })}
            </div>
            <span className="dash-bar-label">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
