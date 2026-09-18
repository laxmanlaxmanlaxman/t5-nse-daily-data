import { useMemo, useState } from "react";
import { API_BASE, downloadRange, toIsoDate } from "../nseClient";
import { useNseData } from "../data";

export default function ExportPage() {
  const today = toIsoDate(new Date());
  const [start, setStart] = useState("2026-01-01");
  const [end, setEnd] = useState(today);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const { latestHref } = useNseData();

  const dayCount = useMemo(() => {
    if (!start || !end || start > end) return 0;
    const ms = new Date(`${end}T00:00:00`) - new Date(`${start}T00:00:00`);
    return Math.floor(ms / 86400000) + 1;
  }, [start, end]);

  async function runExport(event) {
    event.preventDefault();
    setError("");
    setMessage("");
    setBusy(true);
    setProgress({ status: "starting" });
    try {
      const result = await downloadRange({ start, end, onProgress: setProgress });
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
    <section>
      <h2>Download CSV</h2>
      <p className="lede">
        Pick any date range. The site asks a free backend to pull official NSE
        daily files for those days, then gives you a CSV. A year can take a
        couple of minutes; a week is usually faster.
      </p>
      {!API_BASE && (
        <p className="error">On-demand API is not configured yet.</p>
      )}
      <form className="range-form" onSubmit={runExport}>
        <label>
          From
          <input type="date" value={start} max={today} onChange={(event) => setStart(event.target.value)} required />
        </label>
        <label>
          To
          <input type="date" value={end} max={today} onChange={(event) => setEnd(event.target.value)} required />
        </label>
        <div className="presets">
          <button type="button" onClick={() => { setStart("2026-01-01"); setEnd(today); }}>
            2026 to today
          </button>
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
        </div>
        <button className="button" type="submit" disabled={busy || !API_BASE || start > end}>
          {busy ? "Working…" : "Download range as CSV"}
        </button>
      </form>
      {dayCount > 0 && (
        <p className="note">
          {dayCount} calendar day{dayCount === 1 ? "" : "s"} selected. Weekends and
          NSE holidays are skipped. Max 366 days.
        </p>
      )}
      {progress && <p className="note">{statusLabel}</p>}
      {message && <p className="status-pill ok">{message}</p>}
      {error && <p className="error">{error}</p>}
      <h3>Latest session only</h3>
      <a className="button secondary" href={latestHref || "./data/nse_daily_2026_latest.csv"}>
        Download latest day
      </a>
      <p className="disclaimer">
        Files come from NSE India public reports. For personal/research use.
        Verify prices on nseindia.com before acting on them.
      </p>
    </section>
  );
}
