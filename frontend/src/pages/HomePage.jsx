import { Link } from "react-router-dom";
import { formatNumber, useNseData } from "../data";
import { formatNiceDate, statusClass } from "../dataset";
import Tip from "../components/Tip.jsx";

export default function HomePage() {
  const { manifest, t6, t6Files, loading, error } = useNseData();
  const dailyReady = manifest && manifest.status !== "pending";

  return (
    <section>
      <p className="lede">
        Two matching tools for NSE EQ stocks: official daily bars, and a
        background 1-minute archive. Preview, export, or check status for either.
      </p>
      {loading && <p className="note">Loading snapshot…</p>}
      {error && <p className="error">{error}</p>}
      <div className="product-grid">
        <article className="panel">
          <p className="kicker">T5</p>
          <h2>Daily</h2>
          <p className="note">Official NSE bhavcopy. One row per stock per trading day.</p>
          <p className={`status-pill ${statusClass(manifest?.status)}`}>
            {dailyReady ? `Latest session ${formatNiceDate(manifest.latestDate)}` : "Waiting for data"}
          </p>
          <dl className="meta">
            <div>
              <dt>Trading days</dt>
              <dd>{dailyReady ? formatNumber(manifest.tradingDays) : "—"}</dd>
            </div>
            <div>
              <dt>Rows so far</dt>
              <dd>{dailyReady ? formatNumber(manifest.rowCount) : "—"}</dd>
            </div>
          </dl>
          <div className="actions">
            <Tip text="Open a table of daily prices. You can change the date range.">
              <Link className="button" to="/preview">
                Preview data
              </Link>
            </Tip>
            <Tip text="Build or download a daily CSV">
              <Link className="button secondary" to="/export">
                Export CSV
              </Link>
            </Tip>
            <Tip text="Last daily pipeline run">
              <Link className="button secondary" to="/status">
                Pipeline status
              </Link>
            </Tip>
          </div>
        </article>
        <article className="panel">
          <p className="kicker">T6</p>
          <h2>1-minute</h2>
          <p className="note">Collected overnight. Grows forward; not a 10-year official archive.</p>
          <p className={`status-pill ${statusClass(t6?.status)}`}>
            {t6?.generatedAt
              ? `Last collection ${formatNiceDate(t6.generatedAt)}`
              : "Waiting for first run"}
          </p>
          <dl className="meta">
            <div>
              <dt>Tickers with data</dt>
              <dd>{formatNumber(t6?.symbolsOk)}</dd>
            </div>
            <div>
              <dt>Files collected</dt>
              <dd>{formatNumber(t6Files?.length)}</dd>
            </div>
          </dl>
          <div className="actions">
            <Tip text="See which 1-minute files have been collected">
              <Link className="button" to="/preview?set=minute">
                Preview data
              </Link>
            </Tip>
            <Tip text="Download 1-minute CSVs by date">
              <Link className="button secondary" to="/export?set=minute">
                Export CSV
              </Link>
            </Tip>
            <Tip text="Last 1-minute collection run">
              <Link className="button secondary" to="/status?set=minute">
                Pipeline status
              </Link>
            </Tip>
          </div>
        </article>
      </div>
      <p className="disclaimer">{manifest?.disclaimer}</p>
    </section>
  );
}
