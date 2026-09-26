# NSE Daily Data

Live site: https://laxmanlaxmanlaxman.github.io/t5-nse-daily-data/

Sandeep picks a **date range** on Export, optionally filters by company or symbol, and can open **More filters** (min volume, min/max close, listing date). A free Cloudflare Worker starts a GitHub Action, which downloads official NSE bhavcopy files and publishes a CSV. Closing your PC does not take this down.

**T6** is a separate background job. NSE does not publish 10 years of 1-minute bars for free. Each weeknight GitHub Actions pulls the latest Yahoo Finance 1-minute window (about 7 days) for every EQ ticker and keeps only new minutes. The archive grows going forward. Download files on the Status page or from the `t6-minute` GitHub Release.

Columns: `Company`, `Symbol`, `Listing Date`, `Interval`, `Open`, `High`, `Low`, `Close`, `Volume`, `date`.

## Why a backend

Browsers cannot call NSE (CORS). Cloudflare Workers also cannot fetch NSE archives (NSE returns HTTP 520 from those IPs). GitHub-hosted runners can, which we already verified.

So: **Pages UI → Worker (free) → GitHub Action (free) → NSE public archives → CSV download.**

No paid plans. Official public reports only, personal/research use. Verify on nseindia.com.

## Local CSV

```powershell
python -m pip install -r backend/requirements.txt
python backend/nse_daily.py --start 2026-09-01 --end 2026-09-17 --out ./output
python backend/nse_minute.py --max-symbols 5 --out ./output/t6
```

## Local UI

```powershell
cd frontend
npm install
npm run dev
```

## Deploy Worker after Cloudflare login

```powershell
cd worker
npx wrangler deploy
```
