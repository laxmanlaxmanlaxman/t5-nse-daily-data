import { useMemo, useState } from "react";
import { formatNumber, useNseData } from "../data";

const COLUMNS = [
  "Company",
  "Symbol",
  "Listing Date",
  "Interval",
  "Open",
  "High",
  "Low",
  "Close",
  "Volume",
  "date",
];

export default function PreviewPage() {
  const { rows, manifest, loading, error } = useNseData();
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter((row) =>
      `${row.Company} ${row.Symbol}`.toLowerCase().includes(needle)
    );
  }, [rows, query]);

  return (
    <section>
      <div className="toolbar">
        <div>
          <h2>Latest trading day</h2>
          <p className="note">
            {manifest?.latestDate
              ? `${formatNumber(filtered.length)} of ${formatNumber(rows.length)} EQ rows for ${manifest.latestDate}`
              : "Run the Python pipeline to populate this table."}
          </p>
        </div>
        <input
          type="search"
          placeholder="Search company or symbol"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>
      {loading && <p className="note">Loading table…</p>}
      {error && <p className="error">{error}</p>}
      {!loading && !rows.length && (
        <p className="note">
          No preview CSV yet. Generate it with{" "}
          <code>python backend/nse_daily.py --year 2026</code>.
        </p>
      )}
      {filtered.length > 0 && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                {COLUMNS.map((col) => (
                  <th key={col}>{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => (
                <tr key={`${row.Symbol}-${row.date}`}>
                  {COLUMNS.map((col) => (
                    <td key={col} className={["Open", "High", "Low", "Close", "Volume"].includes(col) ? "num" : ""}>
                      {["Open", "High", "Low", "Close", "Volume"].includes(col)
                        ? formatNumber(row[col])
                        : row[col]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
