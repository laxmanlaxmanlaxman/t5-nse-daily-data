import { useNseData } from "../data";

export default function ExportPage() {
  const { manifest, fullHref, latestHref, monthly, repo } = useNseData();
  const ready = manifest && manifest.status !== "pending" && manifest.rowCount > 0;

  return (
    <section>
      <h2>Download CSV</h2>
      <p className="lede">
        Columns: Company, Symbol, Listing Date, Interval, Open, High, Low, Close,
        Volume, date. Interval is always daily.
      </p>
      {!ready && (
        <p className="note">
          Full-year files appear here after the pipeline (or GitHub Action) has
          run. The latest-day preview can still be generated locally.
        </p>
      )}
      <div className="download-list">
        <a
          className={fullHref ? "button" : "button disabled"}
          href={fullHref || undefined}
          aria-disabled={!fullHref}
        >
          Full 2026 CSV
        </a>
        <a className="button secondary" href={latestHref || "./data/nse_daily_2026_latest.csv"}>
          Latest day only
        </a>
      </div>
      {!repo && (
        <p className="note">
          If a download 404s, generate files locally with{" "}
          <code>python backend/nse_daily.py --year 2026</code> or wait for the
          GitHub Action release.
        </p>
      )}
      {monthly.length > 0 && (
        <>
          <h3>By month</h3>
          <div className="month-grid">
            {monthly.map((item) => (
              <a key={item.fileName} href={item.href}>
                {item.label}
              </a>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
