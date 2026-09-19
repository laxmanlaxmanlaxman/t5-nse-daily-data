import { Link } from "react-router-dom";
import { formatNumber, useNseData } from "../data";

export default function HomePage() {
  const { manifest, loading, error } = useNseData();
  const ready = manifest && manifest.status !== "pending";

  return (
    <section>
      <p className="lede">
        Daily open, high, low, close and volume for NSE EQ stocks. Filter by
        company or symbol, then pick any date range on Export. A background T6
        job also collects the latest available 1-minute bars for every ticker.
      </p>
      {loading && <p className="note">Loading snapshot…</p>}
      {error && <p className="error">{error}</p>}
      <div className="stats">
        <article>
          <span>Year</span>
          <strong>2026</strong>
        </article>
        <article>
          <span>Trading days</span>
          <strong>{ready ? formatNumber(manifest.tradingDays) : "—"}</strong>
        </article>
        <article>
          <span>Rows in full CSV</span>
          <strong>{ready ? formatNumber(manifest.rowCount) : "—"}</strong>
        </article>
        <article>
          <span>Latest session</span>
          <strong>{manifest?.latestDate || "—"}</strong>
        </article>
      </div>
      <div className="actions">
        <Link className="button" to="/preview">
          Preview latest day
        </Link>
        <Link className="button secondary" to="/export">
          Export CSV
        </Link>
        <Link className="button secondary" to="/status">
          T6 minute status
        </Link>
      </div>
      <p className="disclaimer">{manifest?.disclaimer}</p>
    </section>
  );
}
