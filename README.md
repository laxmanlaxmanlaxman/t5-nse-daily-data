# NSE Daily Data 2026

Hosted UI for Sandeep: preview the latest NSE cash-market session and download daily OHLCV for **all EQ stocks in 2026**.

Columns: `Company`, `Symbol`, `Listing Date`, `Interval`, `Open`, `High`, `Low`, `Close`, `Volume`, `date`. Interval is always `daily`.

## Why this is not a browser-only app

NSE blocks browser calls. This repo pre-builds CSVs from official **CM-UDiFF bhavcopy** zips on `nsearchives.nseindia.com`, then the React app serves preview + download.

## Local CSV (Python)

```powershell
cd "D:\Python AWS - 2\T5 - NSE Data"
python -m pip install -r backend/requirements.txt
python backend/nse_daily.py --year 2026 --out ./output
```

Short test:

```powershell
python backend/nse_daily.py --year 2026 --start 2026-09-15 --end 2026-09-17 --out ./output
```

Writes:

- `output/nse_daily_2026.csv` — full range
- `output/nse_daily_2026_latest.csv` — last trading day in the range
- `output/nse_daily_2026_MM.csv` — one file per month
- `frontend/public/data/` — latest CSV + `manifest.json` for the UI

## Local UI

```powershell
cd frontend
npm install
npm run dev
```

Open the printed localhost URL. Full-year download buttons light up after GitHub Releases exist (`VITE_GITHUB_REPO` is set in the Pages deploy workflow).

## Hosted product

| Piece | Where |
| --- | --- |
| UI | GitHub Pages after `scripts/deploy.ps1` |
| Large CSVs | GitHub Release `nse-daily-2026`, also served from `/data/` on the static site |
| Refresh | Action `Refresh NSE 2026 data` (weekdays 13:30 UTC / 19:00 IST, plus manual run) |

Publish (one-time GitHub login):

```powershell
& "$env:ProgramFiles\GitHub CLI\gh.exe" auth login --web
powershell -File scripts/deploy.ps1
```

That creates the public repo `t5-nse-daily-data`, deploys Pages, and starts the CSV release workflow. Share `https://<your-github-user>.github.io/t5-nse-daily-data/` with Sandeep.

Vercel alternative from `frontend/`: `npx vercel --prod` (set the project root to `frontend`).

## Data notes

- Default series is **EQ** only.
- Weekends and NSE holidays are skipped (HTTP 404).
- Figures come from NSE public reports. Verify on [nseindia.com](https://www.nseindia.com/) before using them.
