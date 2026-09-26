export default function Loader({ label = "Loading…" }) {
  return (
    <div className="loader" role="status" aria-live="polite">
      <span className="spinner" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}

export function LoaderOverlay({ label = "Loading…" }) {
  return (
    <div className="loader-overlay" role="status" aria-live="polite">
      <Loader label={label} />
    </div>
  );
}
