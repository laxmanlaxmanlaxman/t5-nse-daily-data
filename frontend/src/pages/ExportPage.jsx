import { useMemo, useState } from "react";
import DatasetSwitch from "../components/DatasetSwitch.jsx";
import FileTable from "../components/FileTable.jsx";
import FilterBar from "../components/FilterBar.jsx";
import Loader from "../components/Loader.jsx";
import Tip from "../components/Tip.jsx";
import { useNseData } from "../data";
import { describeDailyFiles, describeMinuteFiles, useDataset } from "../dataset";
import { EMPTY_FILTERS } from "../filters";
import { API_BASE, downloadRange, downloadUrls, toIsoDate } from "../nseClient";

function DailyExport() {
  const today = toIsoDate(new Date());
  const [start, setStart] = useState("2026-01-01");
  const [end, setEnd] = useState(today);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [showMore, setShowMore] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const { latestHref, fullHref, monthly, manifest } = useNseData();
  const readyFiles = describeDailyFiles({
    latestHref,
    fullHref,
    monthly,
    latestDate: manifest?.latestDate,
  });

  const dayCount = useMemo(() => {
    if (!start || !end || start > end) return 0;
    return Math.floor((new Date(`${end}T00:00:00`) - new Date(`${start}T00:00:00`)) / 86400000) + 1;
  }, [start, end]);

  async function runExport(event) {
    event.preventDefault();
    setError("");
    setMessage("");
    setBusy(true);
    setProgress({ status: "starting" });
    try {
      const result = await downloadRange({ start, end, filters, onProgress: setProgress });
      window.location.assign(result.downloadUrl);
      setMessage(`Ready: ${result.fileName}`);
    } catch (err) {
      setError(err.message || "Export failed");
    } finally {
      setBusy(false);
    }
  }

  const statusLabel = {
    starting: "Starting…",
    queued: "Queued on free GitHub runners…",
    in_progress: "Downloading official NSE bhavcopy files…",
    waiting: "Downloading official NSE bhavcopy files…",
    success: "CSV ready",
  }[progress?.status] || progress?.status;

  return (
    <>
      <p className="note">Build a custom daily CSV, or download a file that is already ready.</p>
      {!API_BASE && <p className="error">On-demand API is not configured yet.</p>}
      <form className="range-form" onSubmit={runExport}>
        <label>
          From
          <input type="date" value={start} max={today} onChange={(event) => setStart(event.target.value)} required />
        </label>
        <label>
          To
          <input type="date" value={end} max={today} onChange={(event) => setEnd(event.target.value)} required />
        </label>
        <FilterBar
          filters={filters}
          onChange={setFilters}
          showMore={showMore}
          onToggleMore={() => setShowMore((value) => !value)}
        />
        <div className="presets">
          <Tip text="From 1 Jan 2026 through today">
            <button type="button" onClick={() => { setStart("2026-01-01"); setEnd(today); }}>
              2026 to today
            </button>
          </Tip>
          <Tip text="Last seven calendar days">
            <button
              type="button"
              onClick={() => {
                const from = new Date();
                from.setDate(from.getDate() - 6);
                setStart(toIsoDate(from));
                setEnd(today);
              }}
            >
              Last 7 days
            </button>
          </Tip>
          <Tip text="From the first of this month">
            <button
              type="button"
              onClick={() => {
                const now = new Date();
                setStart(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`);
                setEnd(today);
              }}
            >
              This month
            </button>
          </Tip>
        </div>
        <Tip text="Fetch official NSE daily files for this range and download a CSV">
          <button className="button" type="submit" disabled={busy || !API_BASE || start > end}>
            {busy ? "Working…" : "Download range as CSV"}
          </button>
        </Tip>
      </form>
      {dayCount > 0 && (
        <p className="note">{dayCount} calendar days selected. Weekends and holidays are skipped. Max 366 days.</p>
      )}
      {busy && <Loader label={statusLabel || "Preparing CSV…"} />}
      {progress && !busy && <p className="note">{statusLabel}</p>}
      {message && <p className="status-pill ok">{message}</p>}
      {error && <p className="error">{error}</p>}
      <h3>Ready files</h3>
      <FileTable files={readyFiles} empty="No daily files published yet." />
    </>
  );
}

function MinuteExport() {
  const { t6Files } = useNseData();
  const today = toIsoDate(new Date());
  const allFiles = describeMinuteFiles(t6Files);
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");

  const files = useMemo(() => {
    return allFiles.filter((file) => {
      if (start && file.iso && file.iso < start) return false;
      if (end && file.iso && file.iso > end) return false;
      return true;
    });
  }, [allFiles, start, end]);

  const latest = allFiles[0];

  async function downloadAll() {
    if (!files.length) return;
    setError("");
    setBusy(true);
    try {
      await downloadUrls(files, (info) =>
        setProgress(`Starting download ${info.index} of ${info.total}: ${info.name}`)
      );
      setProgress("Downloads started. Your browser may ask to allow multiple files.");
    } catch (err) {
      setError(err.message || "Could not start downloads");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <p className="note">
        Each row is one overnight collection. Files are large, so they download
        directly rather than opening in the browser.
      </p>
      <form className="preview-controls" onSubmit={(event) => event.preventDefault()}>
        <label>
          From
          <input type="date" value={start} max={today} onChange={(event) => setStart(event.target.value)} />
        </label>
        <label>
          To
          <input type="date" value={end} max={today} onChange={(event) => setEnd(event.target.value)} />
        </label>
        <div className="presets">
          <Tip text="Show every collected file">
            <button
              type="button"
              onClick={() => {
                setStart("");
                setEnd("");
              }}
            >
              All files
            </button>
          </Tip>
        </div>
      </form>
      <div className="actions">
        {latest && (
          <Tip text="Download the most recent 1-minute collection">
            <a className="button" href={latest.url}>
              Download latest collection
            </a>
          </Tip>
        )}
        {files.length > 1 && (
          <Tip text="Start a download for every file currently listed. Your browser may ask permission.">
            <button className="button secondary" type="button" onClick={downloadAll} disabled={busy}>
              {busy ? "Starting…" : `Download all ${files.length} CSVs`}
            </button>
          </Tip>
        )}
      </div>
      {busy && <Loader label={progress || "Starting downloads…"} />}
      {!busy && progress && <p className="note">{progress}</p>}
      {error && <p className="error">{error}</p>}
      <FileTable files={files} empty="No 1-minute files match these dates yet." />
    </>
  );
}

export default function ExportPage() {
  const { isMinute } = useDataset();
  return (
    <section>
      <div className="toolbar">
        <div>
          <h2>Export</h2>
        </div>
        <DatasetSwitch />
      </div>
      {isMinute ? <MinuteExport /> : <DailyExport />}
    </section>
  );
}
