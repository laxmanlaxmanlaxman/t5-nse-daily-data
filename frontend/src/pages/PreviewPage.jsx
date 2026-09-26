import { useEffect, useMemo, useRef, useState } from "react";
import DatasetSwitch from "../components/DatasetSwitch.jsx";
import FileTable from "../components/FileTable.jsx";
import FilterBar from "../components/FilterBar.jsx";
import Loader from "../components/Loader.jsx";
import PriceTable from "../components/PriceTable.jsx";
import Tip from "../components/Tip.jsx";
import { formatNumber, parseCsv, useNseData } from "../data";
import { describeMinuteFiles, formatNiceDate, useDataset } from "../dataset";
import { applyRowFilters, EMPTY_FILTERS, rowMatchesFilters } from "../filters";
import { API_BASE, loadRangeCsv, streamFilteredCsv, toIsoDate } from "../nseClient";

const TABLE_LIMIT = 8000;
const PREVIEW_MAX_DAYS = 31;

function DailyPreview() {
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
  const rangeLabel = start === end ? formatNiceDate(start) : `${formatNiceDate(start)} → ${formatNiceDate(end)}`;

  return (
    <>
      <p className="note">
        {sourceRows.length
          ? `${formatNumber(filtered.length)} of ${formatNumber(sourceRows.length)} EQ rows for ${rangeLabel}`
          : usingLatest
            ? "Loading the latest trading day…"
            : "Pick dates and click Load table. One session is about 2,600 EQ stocks, not the full year."}
      </p>
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
          <Tip text="Show only the most recent NSE trading day">
            <button
              type="button"
              onClick={() => {
                setStart(latestDate);
                setEnd(latestDate);
              }}
            >
              Latest day
            </button>
          </Tip>
          <Tip text="Load about one week of daily bars">
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
          </Tip>
        </div>
        <Tip text="Fetch this date range and show it in the table">
          <button className="button" type="submit" disabled={busy || start > end || (!usingLatest && !API_BASE)}>
            {busy ? "Loading…" : "Load table"}
          </button>
        </Tip>
      </form>
      <FilterBar
        filters={filters}
        onChange={setFilters}
        showMore={showMore}
        onToggleMore={() => setShowMore((value) => !value)}
      />
      {dayCount > 1 && (
        <p className="note">Longer ranges take a minute or two to fetch from NSE. Weekends and holidays are skipped.</p>
      )}
      {(busy || (loading && usingLatest && !sourceRows.length)) && (
        <Loader label={busy ? statusLabel || "Loading table…" : "Loading latest session…"} />
      )}
      {(error || loadError) && <p className="error">{error || loadError}</p>}
      {needsLoad && !busy && <p className="note">Click Load table to fetch this date range.</p>}
      <PriceTable rows={filtered.slice(0, TABLE_LIMIT)} />
      {filtered.length > TABLE_LIMIT && (
        <p className="note">
          Showing the first {formatNumber(TABLE_LIMIT)} of {formatNumber(filtered.length)} matching rows.
          Download the full set on Export.
        </p>
      )}
      {!busy && sourceRows.length > 0 && filtered.length === 0 && (
        <p className="note">No rows match these filters.</p>
      )}
    </>
  );
}

function MinutePreview() {
  const { t6Files, loading } = useNseData();
  const files = describeMinuteFiles(t6Files);
  const [selected, setSelected] = useState([]);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [showMore, setShowMore] = useState(false);
  const [rows, setRows] = useState([]);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [loadError, setLoadError] = useState("");
  const [truncated, setTruncated] = useState(false);
  const primed = useRef(false);

  useEffect(() => {
    if (!files.length || primed.current) return;
    setSelected([files[0].name]);
    primed.current = true;
  }, [files]);

  const filtered = useMemo(() => applyRowFilters(rows, filters), [rows, filters]);
  const chosen = files.filter((file) => selected.includes(file.name));

  function toggle(name) {
    setSelected((current) =>
      current.includes(name) ? current.filter((item) => item !== name) : [...current, name]
    );
  }

  async function loadPreview(event) {
    event.preventDefault();
    setLoadError("");
    if (!chosen.length) {
      setLoadError("Select at least one collection file.");
      return;
    }
    setBusy(true);
    setRows([]);
    setTruncated(false);
    const collected = [];
    try {
      for (const file of chosen) {
        if (collected.length >= TABLE_LIMIT) {
          setTruncated(true);
          break;
        }
        setProgress(`Reading ${file.label}…`);
        const result = await streamFilteredCsv({
          tag: "t6-minute",
          name: file.name,
          match: (row) => rowMatchesFilters(row, filters),
          limit: TABLE_LIMIT - collected.length,
          onProgress: (info) =>
            setProgress(
              `Reading ${file.label}… ${formatNumber(info.kept)} matching of ${formatNumber(info.scanned)} scanned`
            ),
        });
        collected.push(...result.rows);
        if (result.truncated) setTruncated(true);
      }
      setRows(collected);
      setProgress("");
    } catch (err) {
      setLoadError(err.message || "Could not load minute preview");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <p className="note">
        Tick the collection file(s) to preview, add filters if you like, then Load
        table. Large files are streamed; a company or symbol filter is much faster.
      </p>
      {loading && <Loader label="Loading collection list…" />}
      <form onSubmit={loadPreview}>
        <FilterBar
          filters={filters}
          onChange={setFilters}
          showMore={showMore}
          onToggleMore={() => setShowMore((value) => !value)}
        />
        <FileTable
          files={files}
          showDownload={false}
          selectable
          selected={selected}
          onToggle={toggle}
          onToggleAll={(on) => setSelected(on ? files.map((file) => file.name) : [])}
          empty="No 1-minute files yet. The overnight job has not published any."
        />
        <div className="actions">
          <Tip text="Read the selected files and show matching rows in the table">
            <button className="button" type="submit" disabled={busy || !API_BASE || !chosen.length}>
              {busy ? "Loading…" : "Load table"}
            </button>
          </Tip>
        </div>
      </form>
      {busy && <Loader label={progress || "Reading minute files…"} />}
      {loadError && <p className="error">{loadError}</p>}
      {!busy && rows.length > 0 && (
        <p className="note">
          {formatNumber(filtered.length)} matching rows from {chosen.length} file
          {chosen.length === 1 ? "" : "s"}
          {truncated ? ` (showing the first ${formatNumber(TABLE_LIMIT)})` : ""}
        </p>
      )}
      <PriceTable rows={filtered.slice(0, TABLE_LIMIT)} />
      {!busy && rows.length > 0 && filtered.length === 0 && (
        <p className="note">No rows match these filters. Load table again after changing filters if you need a full rescan.</p>
      )}
    </>
  );
}

export default function PreviewPage() {
  const { isMinute } = useDataset();
  return (
    <section>
      <div className="toolbar">
        <div>
          <h2>Preview</h2>
        </div>
        <DatasetSwitch />
      </div>
      {isMinute ? <MinutePreview /> : <DailyPreview />}
    </section>
  );
}
