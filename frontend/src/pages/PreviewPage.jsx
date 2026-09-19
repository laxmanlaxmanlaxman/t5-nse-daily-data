import { useMemo, useState } from "react";
import FilterBar from "../components/FilterBar.jsx";
import { formatNumber, useNseData } from "../data";
import { applyRowFilters, EMPTY_FILTERS } from "../filters";

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
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [showMore, setShowMore] = useState(false);

  const filtered = useMemo(() => applyRowFilters(rows, filters), [rows, filters]);

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
      </div>
      <FilterBar
        filters={filters}
        onChange={setFilters}
        showMore={showMore}
        onToggleMore={() => setShowMore((value) => !value)}
      />
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
      {!loading && rows.length > 0 && filtered.length === 0 && (
        <p className="note">No rows match these filters.</p>
      )}
    </section>
  );
}
