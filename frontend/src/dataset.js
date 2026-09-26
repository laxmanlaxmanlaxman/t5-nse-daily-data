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
