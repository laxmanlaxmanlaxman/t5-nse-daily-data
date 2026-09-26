import { useEffect, useMemo, useState } from "react";
import FilterBar from "../components/FilterBar.jsx";
import { formatNumber, parseCsv, useNseData } from "../data";
import { applyRowFilters, EMPTY_FILTERS } from "../filters";
import { API_BASE, loadRangeCsv, toIsoDate } from "../nseClient";

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
const TABLE_LIMIT = 8000;
const PREVIEW_MAX_DAYS = 31;

export default function PreviewPage() {
  const { rows: latestRows, manifest, loading, error } = useNseData();
  const today = toIsoDate(new Date());
  const latestDate = manifest?.latestDate || today;
  const [start, setStart] = useState(latestDate);
  const [end, setEnd] = useState(latestDate);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [showMore, setShowMore] = useState(false);
  const [loadedRows, setLoadedRows] = useState(null);
  const [loadedRange, setLoadedRange] = useState(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(null);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    if (!manifest?.latestDate) return;
    setStart(manifest.latestDate);
    setEnd(manifest.latestDate);
  }, [manifest?.latestDate]);

  const usingLatest = start === latestDate && end === latestDate;
  const sourceRows = loadedRows && loadedRange === `${start}|${end}` ? loadedRows : usingLatest ? latestRows : [];
  const filtered = useMemo(() => applyRowFilters(sourceRows, filters), [sourceRows, filters]);
  const visible = filtered.slice(0, TABLE_LIMIT);

  const dayCount = useMemo(() => {
    if (!start || !end || start > end) return 0;
    return Math.floor((new Date(`${end}T00:00:00`) - new Date(`${start}T00:00:00`)) / 86400000) + 1;
  }, [start, end]);

  async function loadPreview(event) {
    event.preventDefault();
    setLoadError("");
    if (usingLatest) {
      setLoadedRows(null);
      setLoadedRange(`${start}|${end}`);
      setProgress(null);
      return;
    }
    if (dayCount > PREVIEW_MAX_DAYS) {
      setLoadError(`Preview is limited to ${PREVIEW_MAX_DAYS} days. Use Export for longer ranges.`);
      return;
    }
    setBusy(true);
    setProgress({ status: "starting" });
    try {
      const result = await loadRangeCsv({ start, end, onProgress: setProgress });
      setLoadedRows(parseCsv(result.text));
      setLoadedRange(`${start}|${end}`);
    } catch (err) {
      setLoadError(err.message || "Could not load preview");
    } finally {
      setBusy(false);
    }
  }

  const statusLabel = {
    starting: "Starting…",
    queued: "Queued on free GitHub runners…",
    in_progress: "Downloading official NSE bhavcopy files…",
    waiting: "Downloading official NSE bhavcopy files…",
    success: "Table ready",
  }[progress?.status] || progress?.status;

  const needsLoad = !usingLatest && loadedRange !== `${start}|${end}`;
  const rangeLabel = start === end ? start : `${start} → ${end}`;

  return (
    <section>
      <div className="toolbar">
        <div>
          <h2>Preview daily data</h2>
          <p className="note">
            {sourceRows.length
              ? `${formatNumber(filtered.length)} of ${formatNumber(sourceRows.length)} EQ rows for ${rangeLabel}`
              : usingLatest
                ? "Loading the latest trading day…"
                : "Pick dates and click Load table. One session is about 2,600 EQ stocks, not the full year."}
          </p>
        </div>
      </div>
      <form className="preview-controls" onSubmit={loadPreview}>
        <label>
          From
          <input type="date" value={start} max={today} onChange={(event) => setStart(event.target.value)} required />
        </label>
        <label>
          To
          <input type="date" value={end} max={today} onChange={(event) => setEnd(event.target.value)} required />
        </label>
        <div className="presets">
          <button
            type="button"
            onClick={() => {
              setStart(latestDate);
              setEnd(latestDate);
            }}
          >
            Latest day
          </button>
          <button
            type="button"
            onClick={() => {
              const from = new Date(`${latestDate}T00:00:00`);
              from.setDate(from.getDate() - 6);
              setStart(toIsoDate(from));
              setEnd(latestDate);
            }}
          >
            Last 7 days
          </button>
        </div>
        <button className="button" type="submit" disabled={busy || start > end || (!usingLatest && !API_BASE)}>
          {busy ? "Loading…" : "Load table"}
        </button>
      </form>
      <FilterBar
        filters={filters}
        onChange={setFilters}
        showMore={showMore}
        onToggleMore={() => setShowMore((value) => !value)}
      />
      {dayCount > 0 && (
        <p className="note">
          {dayCount} calendar days selected. Weekends and holidays are skipped.
          {dayCount > 1 ? " Longer ranges take a minute or two to fetch from NSE." : ""}
        </p>
      )}
      {progress && busy && <p className="note">{statusLabel}</p>}
      {(error || loadError) && <p className="error">{error || loadError}</p>}
      {loading && usingLatest && <p className="note">Loading table…</p>}
      {needsLoad && !busy && (
        <p className="note">Click Load table to fetch this date range from official NSE daily files.</p>
      )}
      {visible.length > 0 && (
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
              {visible.map((row, index) => (
                <tr key={`${row.Symbol}-${row.date}-${index}`}>
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
      {filtered.length > TABLE_LIMIT && (
        <p className="note">
          Showing the first {formatNumber(TABLE_LIMIT)} of {formatNumber(filtered.length)} matching rows.
          Download the full set on Export.
        </p>
      )}
      {!busy && sourceRows.length > 0 && filtered.length === 0 && (
        <p className="note">No rows match these filters.</p>
      )}
    </section>
  );
}
