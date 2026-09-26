import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { fetchFileText, fetchLiveStatus, GITHUB_REPO, releaseDownload } from "./nseClient";

const DataContext = createContext(null);

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    const next = text[i + 1];
    if (quoted) {
      if (ch === '"' && next === '"') {
        cell += '"';
        i += 1;
      } else if (ch === '"') {
        quoted = false;
      } else {
        cell += ch;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === ",") {
      row.push(cell);
      cell = "";
    } else if (ch === "\n") {
      row.push(cell.replace(/\r$/, ""));
      if (row.some((value) => value !== "")) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += ch;
    }
  }
  if (cell.length || row.length) {
    row.push(cell.replace(/\r$/, ""));
    rows.push(row);
  }
  if (!rows.length) return [];
  const headers = rows[0];
  return rows.slice(1).map((values) => {
    const record = {};
    headers.forEach((header, index) => {
      record[header] = values[index] ?? "";
    });
    return record;
  });
}

export function DataProvider({ children }) {
  const [manifest, setManifest] = useState(null);
  const [t6, setT6] = useState(null);
  const [t6Files, setT6Files] = useState([]);
  const [dailyFiles, setDailyFiles] = useState([]);
  const [rows, setRows] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const repo = GITHUB_REPO;

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const live = await fetchLiveStatus().catch(() => null);
        const localManifestRes = await fetch("./data/manifest.json", { cache: "no-store" });
        const localManifest = localManifestRes.ok ? await localManifestRes.json() : null;
        const nextManifest = live?.daily || localManifest;
        if (!nextManifest) throw new Error("Could not load manifest.json");

        const latestName = nextManifest?.files?.latest || "nse_daily_2026_latest.csv";
        let csvText = "";
        try {
          csvText = await fetchFileText({ name: latestName, source: "repo" });
        } catch {
          const csvRes = await fetch(`./data/${latestName}`, { cache: "no-store" });
          csvText = csvRes.ok ? await csvRes.text() : "";
        }

        if (cancelled) return;
        setManifest(nextManifest);
        setT6(live?.t6 || null);
        setT6Files(live?.t6Files || []);
        setDailyFiles(live?.dailyFiles || []);
        setRows(csvText && csvText.includes("Symbol") ? parseCsv(csvText) : []);
      } catch (err) {
        if (!cancelled) setError(err.message || "Failed to load data");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const value = useMemo(() => {
    const files = manifest?.files || {};
    const monthly = (files.monthly || []).map((fileName) => {
      const month = Number(fileName.match(/_(\d{2})\.csv$/)?.[1] || 0);
      return {
        fileName,
        label: MONTH_NAMES[month - 1] || fileName,
        href: repo ? releaseDownload("nse-daily-2026", fileName) : `./data/${fileName}`,
      };
    });
    return {
      manifest,
      t6,
      t6Files,
      dailyFiles,
      rows,
      error,
      loading,
      repo,
      fullHref: files.full ? releaseDownload("nse-daily-2026", files.full) : "",
      latestHref: files.latest
        ? releaseDownload("nse-daily-2026", files.latest)
        : "./data/nse_daily_2026_latest.csv",
      monthly,
    };
  }, [manifest, t6, t6Files, dailyFiles, rows, error, loading, repo]);

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useNseData() {
  const value = useContext(DataContext);
  if (!value) throw new Error("useNseData must be used inside DataProvider");
  return value;
}

export function formatNumber(value) {
  if (value === null || value === undefined || value === "") return "-";
  const num = Number(value);
  if (Number.isNaN(num)) return String(value);
  return num.toLocaleString("en-IN");
}
