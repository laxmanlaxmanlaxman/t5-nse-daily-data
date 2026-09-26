export const API_BASE = (
  import.meta.env.VITE_API_URL || "https://nse-daily-api.t5nsedaily.workers.dev"
).replace(/\/+$/, "");

export const GITHUB_REPO =
  import.meta.env.VITE_GITHUB_REPO || "laxmanlaxmanlaxman/t5-nse-daily-data";

export function toIsoDate(value) {
  const d = value instanceof Date ? value : new Date(value);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

async function readJson(response) {
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || `API HTTP ${response.status}`);
  return body;
}

export async function fetchLiveStatus() {
  if (!API_BASE) return null;
  const response = await fetch(`${API_BASE}/api/status`, { cache: "no-store" });
  if (!response.ok) return null;
  return response.json();
}

export async function fetchFileText({ tag, name, source = "release" }) {
  if (!API_BASE) throw new Error("API is not configured");
  const params = new URLSearchParams({ name, source });
  if (tag) params.set("tag", tag);
  const response = await fetch(`${API_BASE}/api/file?${params}`, { cache: "no-store" });
  if (!response.ok) throw new Error("Could not load CSV");
  return response.text();
}

export async function startExport(start, end, filters = {}) {
  if (!API_BASE) throw new Error("API is not configured");
  return readJson(
    await fetch(`${API_BASE}/api/export`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        start,
        end,
        query: filters.query || "",
        minVolume: filters.minVolume || "",
        minClose: filters.minClose || "",
        maxClose: filters.maxClose || "",
        listedAfter: filters.listedAfter || "",
        listedBefore: filters.listedBefore || "",
      }),
    })
  );
}

export async function pollExport(requestId, start, end) {
  const params = new URLSearchParams({ requestId, start, end });
  return readJson(await fetch(`${API_BASE}/api/export?${params}`));
}

export async function downloadRange({ start, end, filters, onProgress }) {
  const started = await startExport(start, end, filters);
  onProgress?.({ status: "queued", requestId: started.requestId });
  const deadline = Date.now() + 15 * 60 * 1000;
  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 4000));
    const state = await pollExport(started.requestId, start, end);
    onProgress?.(state);
    if (state.status === "success" && state.downloadUrl) return state;
    if (state.status === "failed") {
      throw new Error("NSE fetch failed. Try a shorter range.");
    }
  }
  throw new Error("Timed out waiting for NSE data. Try again.");
}

export async function loadRangeCsv({ start, end, onProgress }) {
  const result = await downloadRange({ start, end, filters: {}, onProgress });
  const text = await fetchFileText({ tag: "on-demand", name: result.fileName });
  return { ...result, text };
}

export function releaseDownload(tag, fileName) {
  if (!GITHUB_REPO || !fileName) return "";
  return `https://github.com/${GITHUB_REPO}/releases/download/${tag}/${fileName}`;
}

export function formatBytes(value) {
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) return "—";
  if (num < 1024 * 1024) return `${Math.round(num / 1024)} KB`;
  return `${(num / (1024 * 1024)).toFixed(1)} MB`;
}

function parseCsvLine(line) {
  const out = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    const next = line[i + 1];
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
      out.push(cell);
      cell = "";
    } else {
      cell += ch;
    }
  }
  out.push(cell.replace(/\r$/, ""));
  return out;
}

function zipRow(headers, values) {
  const record = {};
  headers.forEach((header, index) => {
    record[header] = values[index] ?? "";
  });
  return record;
}

export async function streamFilteredCsv({
  tag,
  name,
  source = "release",
  match,
  limit = 8000,
  onProgress,
  signal,
}) {
  if (!API_BASE) throw new Error("API is not configured");
  const params = new URLSearchParams({ name, source });
  if (tag) params.set("tag", tag);
  const response = await fetch(`${API_BASE}/api/file?${params}`, { cache: "no-store", signal });
  if (!response.ok) throw new Error(`Could not load ${name}`);
  if (!response.body) {
    const text = await response.text();
    const rows = [];
    const lines = text.split(/\n/);
    const headers = parseCsvLine(lines[0] || "");
    for (const line of lines.slice(1)) {
      if (!line.trim()) continue;
      const row = zipRow(headers, parseCsvLine(line));
      if (match && !match(row)) continue;
      rows.push(row);
      if (rows.length >= limit) break;
    }
    return { rows, truncated: rows.length >= limit, scanned: lines.length - 1 };
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let headers = null;
  const rows = [];
  let scanned = 0;
  let truncated = false;
  while (true) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value || new Uint8Array(), { stream: !done });
    const parts = buffer.split("\n");
    buffer = done ? "" : parts.pop() || "";
    for (const line of parts) {
      const trimmed = line.replace(/\r$/, "");
      if (!trimmed) continue;
      if (!headers) {
        headers = parseCsvLine(trimmed);
        continue;
      }
      scanned += 1;
      const row = zipRow(headers, parseCsvLine(trimmed));
      if (!match || match(row)) {
        rows.push(row);
        if (rows.length >= limit) {
          truncated = true;
          onProgress?.({ name, kept: rows.length, scanned });
          await reader.cancel();
          return { rows, truncated, scanned };
        }
      }
      if (scanned % 1500 === 0) onProgress?.({ name, kept: rows.length, scanned });
    }
    if (done) break;
  }
  if (buffer.trim() && headers) {
    scanned += 1;
    const row = zipRow(headers, parseCsvLine(buffer.replace(/\r$/, "")));
    if (!match || match(row)) rows.push(row);
  }
  return { rows, truncated, scanned };
}

export async function downloadUrls(files, onProgress) {
  for (let index = 0; index < files.length; index += 1) {
    const file = files[index];
    onProgress?.({ index: index + 1, total: files.length, name: file.label || file.name });
    const link = document.createElement("a");
    link.href = file.url;
    link.download = file.name || "download.csv";
    link.rel = "noopener";
    document.body.appendChild(link);
    link.click();
    link.remove();
    await new Promise((resolve) => setTimeout(resolve, 700));
  }
}
