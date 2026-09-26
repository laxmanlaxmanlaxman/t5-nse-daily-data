const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...cors },
  });
}

function validIso(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value || "");
}

function dayCount(start, end) {
  const a = Date.parse(`${start}T00:00:00Z`);
  const b = Date.parse(`${end}T00:00:00Z`);
  return Math.floor((b - a) / 86400000) + 1;
}

function optionalIso(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  return validIso(text) ? text : "";
}

function optionalNumber(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  if (!/^\d+(\.\d+)?$/.test(text)) return "";
  return text.slice(0, 16);
}

function optionalQuery(value) {
  return String(value || "")
    .replace(/[^\w\s.,&+/-]/g, " ")
    .trim()
    .slice(0, 80);
}

function csvName(start, end, requestId) {
  return `nse_daily_${start}_to_${end}_${requestId}.csv`;
}

function safeName(value) {
  const text = String(value || "");
  if (!/^[\w.\-]+$/.test(text)) return "";
  return text;
}

async function gh(env, path, init = {}) {
  const response = await fetch(`https://api.github.com${path}`, {
    ...init,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${env.GITHUB_TOKEN}`,
      "User-Agent": "nse-daily-api",
      "X-GitHub-Api-Version": "2022-11-28",
      ...(init.headers || {}),
    },
  });
  const text = await response.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = { raw: text };
  }
  if (!response.ok) {
    throw new Error(body?.message || `GitHub HTTP ${response.status}`);
  }
  return body;
}

async function repoJson(env, path) {
  const body = await gh(env, `/repos/${env.GITHUB_REPO}/contents/${path}`);
  const encoded = String(body.content || "").replace(/\n/g, "");
  return JSON.parse(atob(encoded));
}

async function getRelease(env, tag) {
  try {
    return await gh(env, `/repos/${env.GITHUB_REPO}/releases/tags/${tag}`);
  } catch {
    return null;
  }
}

function assetList(release, tag, repo) {
  return (release?.assets || []).map((asset) => ({
    name: asset.name,
    size: asset.size,
    updatedAt: asset.updated_at,
    url: `https://github.com/${repo}/releases/download/${tag}/${asset.name}`,
  }));
}

async function fetchAsset(env, tag, name) {
  const release = await getRelease(env, tag);
  const asset = (release?.assets || []).find((item) => item.name === name);
  if (!asset) return null;
  return fetch(asset.browser_download_url, {
    headers: { "User-Agent": "nse-daily-api" },
    redirect: "follow",
  });
}

async function fetchRepoFile(env, path) {
  return fetch(
    `https://raw.githubusercontent.com/${env.GITHUB_REPO}/main/${path}?t=${Date.now()}`,
    { headers: { "User-Agent": "nse-daily-api" } }
  );
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors });
    }

    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, "") || "/";

    if (path === "/" || path === "/health") {
      return json({
        ok: true,
        service: "nse-daily-api",
        mode: "github-actions",
        source: "nsearchives.nseindia.com public bhavcopy",
      });
    }

    if (request.method === "GET" && path === "/api/status") {
      if (!env.GITHUB_TOKEN) return json({ error: "API is not configured" }, 500);
      const [daily, t6, t6Release, dailyRelease] = await Promise.all([
        repoJson(env, "frontend/public/data/manifest.json").catch(() => null),
        repoJson(env, "frontend/public/data/t6_status.json").catch(() => null),
        getRelease(env, "t6-minute"),
        getRelease(env, "nse-daily-2026"),
      ]);
      const t6FromRelease = (t6Release?.assets || []).find((item) => item.name === "t6_status.json");
      let t6Live = t6;
      if (t6FromRelease) {
        const statusRes = await fetchAsset(env, "t6-minute", "t6_status.json");
        if (statusRes?.ok) {
          t6Live = await statusRes.json().catch(() => t6);
        }
      }
      return json({
        daily,
        t6: t6Live,
        t6Files: assetList(t6Release, "t6-minute", env.GITHUB_REPO).filter((item) =>
          item.name.endsWith(".csv")
        ),
        dailyFiles: assetList(dailyRelease, "nse-daily-2026", env.GITHUB_REPO),
      });
    }

    if (request.method === "GET" && path === "/api/file") {
      if (!env.GITHUB_TOKEN) return json({ error: "API is not configured" }, 500);
      const tag = safeName(url.searchParams.get("tag"));
      const name = safeName(url.searchParams.get("name"));
      const source = url.searchParams.get("source") || "release";
      let fileRes = null;
      if (source === "repo" && name) {
        fileRes = await fetchRepoFile(env, `frontend/public/data/${name}`);
      } else if (tag && name) {
        fileRes = await fetchAsset(env, tag, name);
      }
      if (!fileRes || !fileRes.ok) {
        return json({ error: "File not found" }, 404);
      }
      return new Response(fileRes.body, {
        status: 200,
        headers: {
          "Content-Type": name.endsWith(".json")
            ? "application/json; charset=utf-8"
            : "text/csv; charset=utf-8",
          "Cache-Control": "no-store",
          ...cors,
        },
      });
    }

    if (request.method === "POST" && path === "/api/export") {
      if (!env.GITHUB_TOKEN) return json({ error: "API is not configured" }, 500);
      const payload = await request.json().catch(() => ({}));
      const start = payload.start;
      const end = payload.end;
      if (!validIso(start) || !validIso(end) || start > end) {
        return json({ error: "start and end must be YYYY-MM-DD" }, 400);
      }
      const days = dayCount(start, end);
      if (days > 366) return json({ error: "Range cannot exceed 366 days" }, 400);
      const requestId = crypto.randomUUID();
      const inputs = {
        start,
        end,
        request_id: requestId,
        query: optionalQuery(payload.query),
        min_volume: optionalNumber(payload.minVolume),
        min_close: optionalNumber(payload.minClose),
        max_close: optionalNumber(payload.maxClose),
        listed_after: optionalIso(payload.listedAfter),
        listed_before: optionalIso(payload.listedBefore),
      };
      await gh(env, `/repos/${env.GITHUB_REPO}/actions/workflows/fetch-range.yml/dispatches`, {
        method: "POST",
        body: JSON.stringify({
          ref: "main",
          inputs,
        }),
      });
      return json({ requestId, start, end, days, status: "queued" }, 202);
    }

    if (request.method === "GET" && path === "/api/export") {
      if (!env.GITHUB_TOKEN) return json({ error: "API is not configured" }, 500);
      const requestId = url.searchParams.get("requestId") || "";
      if (!requestId) return json({ error: "requestId is required" }, 400);
      const runs = await gh(
        env,
        `/repos/${env.GITHUB_REPO}/actions/workflows/fetch-range.yml/runs?per_page=20`
      );
      const run = (runs.workflow_runs || []).find((item) =>
        (item.display_title || item.name || "").includes(requestId)
      );
      if (!run) return json({ requestId, status: "queued" });
      if (run.status !== "completed") {
        return json({ requestId, status: run.status, conclusion: run.conclusion || null });
      }
      if (run.conclusion !== "success") {
        return json({
          requestId,
          status: "failed",
          conclusion: run.conclusion,
          logUrl: run.html_url,
        }, 502);
      }
      const start = url.searchParams.get("start");
      const end = url.searchParams.get("end");
      const fileName = csvName(start, end, requestId);
      const downloadUrl = `https://github.com/${env.GITHUB_REPO}/releases/download/on-demand/${fileName}`;
      return json({
        requestId,
        status: "success",
        downloadUrl,
        fileName,
      });
    }

    return json({ error: "not found" }, 404);
  },
};
