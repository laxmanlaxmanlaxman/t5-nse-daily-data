import { useSearchParams } from "react-router-dom";
import { formatBytes } from "./nseClient";

export function useDataset() {
  const [params, setParams] = useSearchParams();
  const dataset = params.get("set") === "minute" ? "minute" : "daily";

  function setDataset(next) {
    const copy = new URLSearchParams(params);
    if (next === "minute") copy.set("set", "minute");
    else copy.delete("set");
    setParams(copy, { replace: true });
  }

  const qs = dataset === "minute" ? "?set=minute" : "";
  return { dataset, setDataset, qs, isMinute: dataset === "minute" };
}

export function formatNiceDate(iso) {
  if (!iso) return "—";
  const stamp = new Date(`${String(iso).slice(0, 10)}T00:00:00`);
  if (Number.isNaN(stamp.getTime())) return iso;
  return stamp.toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function statusClass(value) {
  if (value === "ok") return "ok";
  if (value === "partial" || value === "pending" || value === "idle") return "partial";
  return "";
}

export function describeMinuteFiles(files) {
  const parsed = (files || []).map((file) => {
    const iso = file.name?.match(/nse_1m_(\d{4}-\d{2}-\d{2})/)?.[1] || "";
    return {
      ...file,
      iso,
      label: iso ? formatNiceDate(iso) : file.name,
      sizeLabel: formatBytes(file.size),
    };
  });
  parsed.sort((a, b) => (b.iso || "").localeCompare(a.iso || ""));
  const oldest = parsed[parsed.length - 1]?.iso;
  return parsed.map((file) => ({
    ...file,
    blurb:
      file.iso && file.iso === oldest && parsed.length > 1
        ? "First collection, including the initial ~7-day window"
        : "New 1-minute bars from that night",
  }));
}

export function describeDailyFiles({ latestHref, fullHref, monthly, latestDate }) {
  const rows = [];
  if (latestHref) {
    rows.push({
      name: "latest",
      label: latestDate ? formatNiceDate(latestDate) : "Latest session",
      blurb: "One trading day, all EQ stocks",
      url: latestHref,
      sizeLabel: "",
    });
  }
  if (fullHref) {
    rows.push({
      name: "full",
      label: "2026 so far",
      blurb: "All trading days in this year",
      url: fullHref,
      sizeLabel: "",
    });
  }
  (monthly || []).forEach((month) => {
    rows.push({
      name: month.fileName,
      label: `${month.label} 2026`,
      blurb: "Daily bars for this month",
      url: month.href,
      sizeLabel: "",
    });
  });
  return rows;
}

const NUMERIC_SORT = new Set(["Open", "High", "Low", "Close", "Volume", "size"]);

export function nextSort(current, key) {
  if (current.key !== key) return { key, dir: "asc" };
  return { key, dir: current.dir === "asc" ? "desc" : "asc" };
}

export function sortMark(sort, key) {
  if (sort?.key !== key) return "↕";
  return sort.dir === "asc" ? "↑" : "↓";
}

export function sortRows(rows, sort) {
  if (!sort?.key || !sort.dir) return rows;
  const key = sort.key;
  const dir = sort.dir === "desc" ? -1 : 1;
  return [...rows].sort((a, b) => {
    if (key === "iso" || key === "Date") {
      return dir * String(a.iso || "").localeCompare(String(b.iso || ""));
    }
    if (key === "size") {
      return dir * ((Number(a.size) || 0) - (Number(b.size) || 0));
    }
    const av = a[key];
    const bv = b[key];
    if (key === "date" || key === "Listing Date") {
      const da = Date.parse(av || "") || 0;
      const db = Date.parse(bv || "") || 0;
      if (da !== db) return dir * (da - db);
    }
    if (NUMERIC_SORT.has(key)) {
      const na = Number(av);
      const nb = Number(bv);
      if (Number.isNaN(na) && Number.isNaN(nb)) return 0;
      if (Number.isNaN(na)) return 1;
      if (Number.isNaN(nb)) return -1;
      return dir * (na - nb);
    }
    return dir * String(av ?? "").localeCompare(String(bv ?? ""), "en-IN", {
      numeric: true,
      sensitivity: "base",
    });
  });
}
