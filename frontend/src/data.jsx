import { createContext, useContext, useEffect, useMemo, useState } from "react";

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

function releaseUrl(repo, fileName) {
  if (!repo || !fileName) return "";
  return `https://github.com/${repo}/releases/latest/download/${fileName}`;
}

export function DataProvider({ children }) {
  const [manifest, setManifest] = useState(null);
  const [rows, setRows] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const repo = import.meta.env.VITE_GITHUB_REPO || "";

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const manifestRes = await fetch("./data/manifest.json", { cache: "no-store" });
        if (!manifestRes.ok) throw new Error("Could not load manifest.json");
        const nextManifest = await manifestRes.json();
        const latestName = nextManifest?.files?.latest || "nse_daily_2026_latest.csv";
        const csvRes = await fetch(`./data/${latestName}`, { cache: "no-store" });
        const csvText = csvRes.ok ? await csvRes.text() : "";
        if (cancelled) return;
        setManifest(nextManifest);
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
        href: repo ? releaseUrl(repo, fileName) : `./data/${fileName}`,
      };
    });
    return {
      manifest,
      rows,
      error,
      loading,
      repo,
      fullHref: files.full
        ? repo
          ? releaseUrl(repo, files.full)
          : `./data/${files.full}`
        : "",
      latestHref: files.latest
        ? repo
          ? releaseUrl(repo, files.latest)
          : `./data/${files.latest}`
        : "",
      monthly,
    };
  }, [manifest, rows, error, loading, repo]);

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
