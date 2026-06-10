export default function LoadingOverlay({ message }) {
  return (
    <div className="byp-loader-overlay" role="status" aria-live="polite" aria-busy="true">
      <div className="byp-loader-card">
        <div className="byp-loader-spinner" aria-hidden="true">
          <svg viewBox="0 0 50 50" className="byp-loader-svg">
            <circle className="byp-loader-track" cx="25" cy="25" r="20" />
            <circle className="byp-loader-arc" cx="25" cy="25" r="20" />
          </svg>
        </div>
        <p className="byp-loader-text">{message}</p>
      </div>
    </div>
  );
}
