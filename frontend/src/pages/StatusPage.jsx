import { formatNumber, useNseData } from "../data";

export default function StatusPage() {
  const { manifest, loading, error, repo } = useNseData();

  if (loading) return <p className="note">Checking pipeline status…</p>;
  if (error) return <p className="error">{error}</p>;
  if (!manifest) return <p className="note">No manifest found.</p>;

  const failed = manifest.failedDays || [];
  const statusLabel =
    manifest.status === "ok"
      ? "Last run succeeded"
      : manifest.status === "partial"
        ? "Last run completed with skipped days"
        : "Waiting for first pipeline run";

  return (
    <section>
      <h2>Pipeline status</h2>
      <p className={`status-pill ${manifest.status}`}>{statusLabel}</p>
      <dl className="meta">
        <div>
          <dt>Generated at (UTC)</dt>
          <dd>{manifest.generatedAt || "—"}</dd>
        </div>
        <div>
          <dt>Range</dt>
          <dd>
            {manifest.startDate || "—"} → {manifest.endDate || "—"}
          </dd>
        </div>
        <div>
          <dt>Trading days</dt>
          <dd>{formatNumber(manifest.tradingDays)}</dd>
        </div>
        <div>
          <dt>Series</dt>
          <dd>{(manifest.series || []).join(", ") || "EQ"}</dd>
        </div>
        <div>
          <dt>Release tag</dt>
          <dd>{manifest.releaseTag || "nse-daily-2026"}</dd>
        </div>
        <div>
          <dt>GitHub repo</dt>
          <dd>{repo || "not configured yet"}</dd>
        </div>
      </dl>
      {failed.length > 0 && (
        <>
          <h3>Failed days</h3>
          <ul className="fail-list">
            {failed.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
