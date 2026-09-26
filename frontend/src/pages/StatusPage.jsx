import { formatBytes, releaseDownload } from "../nseClient";
import { formatNumber, useNseData } from "../data";

function statusClass(value) {
  if (value === "ok") return "ok";
  if (value === "partial" || value === "pending" || value === "idle") return "partial";
  return "";
}

export default function StatusPage() {
  const { manifest, t6, t6Files, loading, error, repo } = useNseData();

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

  const t6Label = {
    ok: "Last collection succeeded",
    partial: "Last collection completed with some missing tickers",
    idle: "Ran, but no new minutes yet (holiday or already up to date)",
    pending: "Waiting for the first background run",
    error: "Last collection failed",
  }[t6?.status] || "Not started";

  const t6FileHref = t6?.fileName ? releaseDownload("t6-minute", t6.fileName) : "";
  const t6ReleaseHref = repo ? `https://github.com/${repo}/releases/tag/t6-minute` : "";
  const csvFiles = (t6Files || []).slice().reverse();

  return (
    <section>
      <h2>T5 · Daily pipeline</h2>
      <p className={`status-pill ${statusClass(manifest.status)}`}>{statusLabel}</p>
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
          <dt>Rows in full CSV</dt>
          <dd>{formatNumber(manifest.rowCount)}</dd>
        </div>
        <div>
          <dt>Latest session</dt>
          <dd>{manifest.latestDate || "—"}</dd>
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

      <h2 className="section-gap">T6 · Minute collector (background)</h2>
      <p className={`status-pill ${statusClass(t6?.status)}`}>{t6Label}</p>
      <p className="lede">
        Sandeep asked for 10 years of 1-minute data for every ticker. NSE does
        not publish that for free. Each weeknight this job silently collects the
        latest Yahoo Finance 1-minute window (about 7 days) for every NSE EQ
        stock, keeps only new minutes, and stores a CSV. Over time the archive
        grows forward. It cannot rebuild a 10-year history that public sources
        do not provide.
      </p>
      <p className="note">{t6?.note}</p>
      <dl className="meta">
        <div>
          <dt>Last run (UTC)</dt>
          <dd>{t6?.generatedAt || "not run yet"}</dd>
        </div>
        <div>
          <dt>Tickers attempted</dt>
          <dd>{formatNumber(t6?.symbolsAttempted)}</dd>
        </div>
        <div>
          <dt>Tickers with data</dt>
          <dd>{formatNumber(t6?.symbolsOk)}</dd>
        </div>
        <div>
          <dt>New minute rows this run</dt>
          <dd>{formatNumber(t6?.newRows)}</dd>
        </div>
        <div>
          <dt>Latest minute (UTC)</dt>
          <dd>{t6?.lastMinuteUtc || "—"}</dd>
        </div>
        <div>
          <dt>Source</dt>
          <dd>{t6?.source || "Yahoo Finance (1m) + NSE EQUITY_L"}</dd>
        </div>
      </dl>
      <div className="actions">
        {t6FileHref && (
          <a className="button" href={t6FileHref}>
            Download latest T6 CSV
          </a>
        )}
        {t6ReleaseHref && (
          <a className="button secondary" href={t6ReleaseHref}>
            All T6 files on GitHub
          </a>
        )}
      </div>
      {csvFiles.length > 0 && (
        <>
          <h3>Download by collection day</h3>
          <p className="note">Each file is the new 1-minute bars collected that night.</p>
          <ul className="download-list file-list">
            {csvFiles.map((file) => (
              <li key={file.name}>
                <a href={file.url}>
                  {file.name}
                  <span className="note"> {formatBytes(file.size)}</span>
                </a>
              </li>
            ))}
          </ul>
        </>
      )}
      {t6?.failedSymbols?.length > 0 && (
        <>
          <h3>Sample failed tickers</h3>
          <p className="note">{formatNumber(t6.symbolsFailed)} ticker(s) returned no 1-minute bars this run.</p>
          <ul className="fail-list">
            {t6.failedSymbols.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </>
      )}
      <p className="disclaimer">{t6?.disclaimer}</p>
    </section>
  );
}
