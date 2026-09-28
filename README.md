# NSE Daily Data

Live site: https://laxmanlaxmanlaxman.github.io/t5-nse-daily-data/

Sandeep’s main need is **last ~10 years of daily bars for all EQ stocks, with volume**. On **Export → Daily**, download one CSV per year (or all years at once). Columns include `Interval` (`daily`) and `Volume`. Keep the yearly files separate, or concat them.

**1-minute for 10 years is not available from free public sources.** NSE does not publish it. Yahoo Finance only serves about 7 days of 1-minute bars per request. T6 collects that window overnight so a forward archive grows; it cannot backfill a decade. Use Daily for historical analysis.

On-demand custom daily ranges are still limited to **366 days**. Longer history uses the yearly files.

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
