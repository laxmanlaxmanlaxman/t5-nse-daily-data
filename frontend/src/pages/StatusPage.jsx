import { Link } from "react-router-dom";
import DatasetSwitch from "../components/DatasetSwitch.jsx";
import Loader from "../components/Loader.jsx";
import Tip from "../components/Tip.jsx";
import { formatNumber, useNseData } from "../data";
import { formatNiceDate, statusClass, useDataset } from "../dataset";

function pipelineLabel(status, ok, partial, wait) {
  if (status === "ok") return ok;
  if (status === "partial") return partial;
  if (status === "idle") return "Ran, but nothing new yet";
  if (status === "pending") return wait;
  if (status === "error") return "Last run failed";
  return wait;
}

export default function StatusPage() {
  const { manifest, t6, loading, error } = useNseData();
  const { isMinute } = useDataset();

  if (loading) return <Loader label="Checking pipeline status…" />;
  if (error) return <p className="error">{error}</p>;
  if (!manifest) return <p className="note">No manifest found.</p>;

  const dailyLabel = pipelineLabel(
    manifest.status,
    "Last run succeeded",
    "Completed with skipped days",
    "Waiting for first run"
  );
  const minuteLabel = pipelineLabel(
    t6?.status,
    "Last run succeeded",
    "Completed with some missing tickers",
    "Waiting for first run"
  );

  return (
    <section>
      <div className="toolbar">
        <div>
          <h2>Status</h2>
        </div>
        <DatasetSwitch />
      </div>
      <p className="note">Health of the two background jobs. Downloads live on Export.</p>
      <div className="product-grid">
        <article className={`panel ${isMinute ? "" : "active"}`}>
          <p className="kicker">T5</p>
          <h3>Daily pipeline</h3>
          <p className={`status-pill ${statusClass(manifest.status)}`}>{dailyLabel}</p>
          <dl className="meta">
            <div>
              <dt>Last run (UTC)</dt>
              <dd>{manifest.generatedAt || "—"}</dd>
            </div>
            <div>
              <dt>Latest session</dt>
              <dd>{formatNiceDate(manifest.latestDate)}</dd>
            </div>
            <div>
              <dt>Trading days</dt>
              <dd>{formatNumber(manifest.tradingDays)}</dd>
            </div>
            <div>
              <dt>Rows so far</dt>
              <dd>{formatNumber(manifest.rowCount)}</dd>
            </div>
          </dl>
          {manifest.failedDays?.length > 0 && (
            <details>
              <summary>Skipped or failed days</summary>
              <ul className="fail-list">
                {manifest.failedDays.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </details>
          )}
          <div className="actions">
            <Tip text="Download daily CSVs">
              <Link className="button secondary" to="/export">
                Export CSV
              </Link>
            </Tip>
          </div>
        </article>
        <article className={`panel ${isMinute ? "active" : ""}`}>
          <p className="kicker">T6</p>
          <h3>1-minute pipeline</h3>
          <p className={`status-pill ${statusClass(t6?.status)}`}>{minuteLabel}</p>
          <dl className="meta">
            <div>
              <dt>Last run (UTC)</dt>
              <dd>{t6?.generatedAt || "not run yet"}</dd>
            </div>
            <div>
              <dt>Tickers with data</dt>
              <dd>{formatNumber(t6?.symbolsOk)}</dd>
            </div>
            <div>
              <dt>New rows last run</dt>
              <dd>{formatNumber(t6?.newRows)}</dd>
            </div>
            <div>
              <dt>Latest minute (UTC)</dt>
              <dd>{t6?.lastMinuteUtc || "—"}</dd>
            </div>
          </dl>
          <details>
            <summary>Why not 10 years of 1-minute data?</summary>
            <p className="note">
              NSE does not publish that for free. Yahoo typically serves about 7
              days of 1-minute bars per request. This job collects that window
              every weeknight and keeps new minutes, so the archive grows
              forward.
            </p>
          </details>
          {t6?.failedSymbols?.length > 0 && (
            <details>
              <summary>{formatNumber(t6.symbolsFailed)} tickers had no 1-minute bars</summary>
              <ul className="fail-list">
                {t6.failedSymbols.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </details>
          )}
          <div className="actions">
            <Tip text="Download 1-minute CSVs">
              <Link className="button secondary" to="/export?set=minute">
                Export CSV
              </Link>
            </Tip>
          </div>
        </article>
      </div>
    </section>
  );
}
