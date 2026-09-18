export const API_BASE = (
  import.meta.env.VITE_API_URL || "https://nse-daily-api.t5nsedaily.workers.dev"
).replace(/\/+$/, "");

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

export async function startExport(start, end) {
  if (!API_BASE) throw new Error("API is not configured");
  return readJson(
    await fetch(`${API_BASE}/api/export`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ start, end }),
    })
  );
}

export async function pollExport(requestId, start, end) {
  const params = new URLSearchParams({ requestId, start, end });
  return readJson(await fetch(`${API_BASE}/api/export?${params}`));
}

export async function downloadRange({ start, end, onProgress }) {
  const started = await startExport(start, end);
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
