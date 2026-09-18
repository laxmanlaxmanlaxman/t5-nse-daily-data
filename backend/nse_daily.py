#!/usr/bin/env python3
"""Download NSE daily equity bars and write Sandeep-format CSVs.

Example:
    python backend/nse_daily.py --year 2026 --out ./output
    python backend/nse_daily.py --year 2026 --start 2026-09-15 --end 2026-09-17 --out ./output
"""

from __future__ import annotations

import argparse
import io
import json
import sys
import time
import zipfile
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from typing import Iterable

import pandas as pd
import requests

NSE_HOME = "https://www.nseindia.com/"
ARCHIVES = "https://nsearchives.nseindia.com"
EQUITY_MASTER_URLS = (
    f"{ARCHIVES}/content/equities/EQUITY_L.csv",
    "https://archives.nseindia.com/content/equities/EQUITY_L.csv",
)
BHAVCOPY_URL = (
    f"{ARCHIVES}/content/cm/BhavCopy_NSE_CM_0_0_0_{{yyyymmdd}}_F_0000.csv.zip"
)

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/128.0.0.0 Safari/537.36"
    ),
    "Accept": "*/*",
    "Accept-Language": "en-US,en;q=0.9",
    "Referer": NSE_HOME,
    "Connection": "keep-alive",
}

OUTPUT_COLUMNS = [
    "Company",
    "Symbol",
    "Listing Date",
    "Interval",
    "Open",
    "High",
    "Low",
    "Close",
    "Volume",
    "date",
]


def log(message: str) -> None:
    print(message, flush=True)


def parse_ymd(value: str) -> date:
    return datetime.strptime(value, "%Y-%m-%d").date()


def daterange(start: date, end: date) -> Iterable[date]:
    cursor = start
    while cursor <= end:
        yield cursor
        cursor += timedelta(days=1)


def format_display_date(value) -> str:
    if value is None or (isinstance(value, float) and pd.isna(value)):
        return ""
    if isinstance(value, str):
        text = value.strip()
        if not text:
            return ""
        for fmt in ("%d-%b-%Y", "%d-%B-%Y", "%Y-%m-%d", "%d/%m/%Y"):
            try:
                return datetime.strptime(text, fmt).strftime("%a, %b %d, %Y")
            except ValueError:
                continue
        parsed = pd.to_datetime(text, errors="coerce")
        if pd.isna(parsed):
            return text
        return parsed.strftime("%a, %b %d, %Y")
    parsed = pd.to_datetime(value, errors="coerce")
    if pd.isna(parsed):
        return ""
    return parsed.strftime("%a, %b %d, %Y")


def build_session() -> requests.Session:
    session = requests.Session()
    session.headers.update(HEADERS)
    try:
        session.get(NSE_HOME, timeout=30)
    except requests.RequestException:
        pass
    try:
        session.get(ARCHIVES, timeout=30)
    except requests.RequestException:
        pass
    return session


def fetch_bytes(session: requests.Session, url: str, retries: int = 4) -> bytes | None:
    last_error: Exception | None = None
    for attempt in range(retries):
        try:
            response = session.get(url, timeout=60)
            if response.status_code == 404:
                return None
            if response.status_code == 200 and response.content:
                return response.content
            last_error = RuntimeError(f"HTTP {response.status_code} for {url}")
        except requests.RequestException as exc:
            last_error = exc
        time.sleep(1.5 * (attempt + 1))
    if last_error:
        raise last_error
    return None


def load_equity_master(session: requests.Session) -> pd.DataFrame:
    content = None
    last_error: Exception | None = None
    for url in EQUITY_MASTER_URLS:
        try:
            content = fetch_bytes(session, url)
            if content:
                break
        except Exception as exc:  # noqa: BLE001 — try the next official URL
            last_error = exc
    if not content:
        raise RuntimeError(f"Could not download EQUITY_L.csv ({last_error})")

    master = pd.read_csv(io.BytesIO(content))
    master.columns = [str(col).strip() for col in master.columns]
    rename = {}
    for col in master.columns:
        key = col.strip().upper()
        if key == "SYMBOL":
            rename[col] = "Symbol"
        elif key in {"NAME OF COMPANY", "COMPANY NAME", "NAME"}:
            rename[col] = "Company"
        elif key in {"DATE OF LISTING", "LISTING DATE"}:
            rename[col] = "Listing Date"
        elif key == "SERIES":
            rename[col] = "MasterSeries"
    master = master.rename(columns=rename)
    if "Symbol" not in master.columns:
        raise RuntimeError(f"EQUITY_L.csv missing SYMBOL column: {list(master.columns)}")
    master["Symbol"] = master["Symbol"].astype(str).str.strip().str.upper()
    if "Company" not in master.columns:
        master["Company"] = ""
    if "Listing Date" not in master.columns:
        master["Listing Date"] = ""
    master = master.drop_duplicates(subset=["Symbol"], keep="first")
    return master[["Symbol", "Company", "Listing Date"]]


def unzip_csv(content: bytes) -> pd.DataFrame:
    with zipfile.ZipFile(io.BytesIO(content)) as archive:
        names = [name for name in archive.namelist() if name.lower().endswith(".csv")]
        if not names:
            raise RuntimeError("Bhavcopy zip had no CSV")
        with archive.open(names[0]) as handle:
            return pd.read_csv(handle)


def normalize_bhavcopy(raw: pd.DataFrame, series: str) -> pd.DataFrame:
    raw.columns = [str(col).strip() for col in raw.columns]
    mapping = {
        "TckrSymb": "Symbol",
        "SYMBOL": "Symbol",
        "SctySrs": "Series",
        "SERIES": "Series",
        "OpnPric": "Open",
        "OPEN_PRICE": "Open",
        "OPEN": "Open",
        "HghPric": "High",
        "HIGH_PRICE": "High",
        "HIGH": "High",
        "LwPric": "Low",
        "LOW_PRICE": "Low",
        "LOW": "Low",
        "ClsPric": "Close",
        "CLOSE_PRICE": "Close",
        "CLOSE": "Close",
        "TtlTradgVol": "Volume",
        "TTL_TRD_QNTY": "Volume",
        "TOTTRDQTY": "Volume",
        "TradDt": "TradeDate",
        "TIMESTAMP": "TradeDate",
        "DATE1": "TradeDate",
        "FinInstrmNm": "InstrumentName",
        "FinInstrmNm ": "InstrumentName",
    }
    frame = raw.rename(columns={col: mapping[col] for col in raw.columns if col in mapping})
    required = {"Symbol", "Series", "Open", "High", "Low", "Close", "Volume", "TradeDate"}
    missing = required - set(frame.columns)
    if missing:
        raise RuntimeError(f"Bhavcopy missing columns {missing}; got {list(raw.columns)}")

    frame["Symbol"] = frame["Symbol"].astype(str).str.strip().str.upper()
    frame["Series"] = frame["Series"].astype(str).str.strip().str.upper()
    frame = frame[frame["Series"] == series.upper()].copy()
    if "InstrumentName" not in frame.columns:
        frame["InstrumentName"] = ""
    frame["TradeDate"] = pd.to_datetime(frame["TradeDate"], errors="coerce").dt.date
    for col in ("Open", "High", "Low", "Close", "Volume"):
        frame[col] = pd.to_numeric(frame[col], errors="coerce")
    return frame.dropna(subset=["Symbol", "TradeDate"])


def to_output(day: pd.DataFrame, master: pd.DataFrame) -> pd.DataFrame:
    merged = day.merge(master, on="Symbol", how="left")
    company = merged["Company"].fillna("").astype(str).str.strip()
    fallback = merged["InstrumentName"].fillna("").astype(str).str.strip()
    merged["Company"] = company.where(company != "", fallback)
    merged["Listing Date"] = merged["Listing Date"].map(format_display_date)
    merged["Interval"] = "daily"
    merged["date"] = merged["TradeDate"].map(format_display_date)
    out = merged[OUTPUT_COLUMNS].copy()
    out = out.sort_values(["date", "Symbol"], kind="mergesort").reset_index(drop=True)
    return out


def write_csv(path: Path, frame: pd.DataFrame) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    frame.to_csv(path, index=False)


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Build NSE daily CSV files.")
    parser.add_argument("--year", type=int, default=date.today().year)
    parser.add_argument("--start", type=str, default=None, help="YYYY-MM-DD")
    parser.add_argument("--end", type=str, default=None, help="YYYY-MM-DD")
    parser.add_argument("--series", type=str, default="EQ")
    parser.add_argument("--out", type=Path, default=Path("output"))
    parser.add_argument(
        "--frontend-dir",
        type=Path,
        default=Path("frontend/public/data"),
        help="Copy latest CSV + manifest here for the React app.",
    )
    parser.add_argument("--delay", type=float, default=0.2)
    parser.add_argument("--cache-dir", type=Path, default=None)
    return parser.parse_args(argv)


def resolve_window(args: argparse.Namespace) -> tuple[date, date]:
    start = parse_ymd(args.start) if args.start else date(args.year, 1, 1)
    today = date.today()
    default_end = date(args.year, 12, 31)
    if args.end:
        end = parse_ymd(args.end)
    elif args.year > today.year:
        end = start
    elif args.year == today.year:
        end = min(today, default_end)
    else:
        end = default_end
    if start > end:
        raise ValueError("start date is after end date")
    return start, end


def load_cached_or_fetch(
    session: requests.Session,
    day: date,
    cache_dir: Path | None,
) -> bytes | None:
    ymd = day.strftime("%Y%m%d")
    cache_file = cache_dir / f"BhavCopy_NSE_CM_{ymd}.zip" if cache_dir else None
    if cache_file and cache_file.exists():
        return cache_file.read_bytes()
    url = BHAVCOPY_URL.format(yyyymmdd=ymd)
    content = fetch_bytes(session, url)
    if content and cache_file:
        cache_file.parent.mkdir(parents=True, exist_ok=True)
        cache_file.write_bytes(content)
    return content


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    start, end = resolve_window(args)
    out_dir: Path = args.out
    out_dir.mkdir(parents=True, exist_ok=True)
    cache_dir = args.cache_dir or (out_dir / ".cache")

    log(f"NSE daily export {start.isoformat()} -> {end.isoformat()} series={args.series}")
    session = build_session()
    master = load_equity_master(session)
    log(f"Equity master: {len(master):,} symbols")

    frames: list[pd.DataFrame] = []
    monthly: dict[int, list[pd.DataFrame]] = {}
    trading_days: list[str] = []
    failed: list[str] = []

    for day in daterange(start, end):
        try:
            content = load_cached_or_fetch(session, day, cache_dir)
        except Exception as exc:  # noqa: BLE001 — keep going through the year
            failed.append(f"{day.isoformat()}: {exc}")
            log(f"  FAIL {day.isoformat()}: {exc}")
            time.sleep(args.delay)
            continue
        if not content:
            log(f"  skip {day.isoformat()} (holiday/weekend)")
            continue
        try:
            raw = unzip_csv(content)
            day_frame = normalize_bhavcopy(raw, args.series)
            mapped = to_output(day_frame, master)
        except Exception as exc:  # noqa: BLE001
            failed.append(f"{day.isoformat()}: {exc}")
            log(f"  FAIL parse {day.isoformat()}: {exc}")
            time.sleep(args.delay)
            continue
        if mapped.empty:
            log(f"  skip {day.isoformat()} (no {args.series} rows)")
            continue
        frames.append(mapped)
        monthly.setdefault(day.month, []).append(mapped)
        trading_days.append(day.isoformat())
        log(f"  {day.isoformat()}  {len(mapped):,} rows")
        time.sleep(args.delay)

    if not frames:
        raise SystemExit("No trading days downloaded. Check dates or NSE availability.")

    full = pd.concat(frames, ignore_index=True)
    year = args.year
    full_path = out_dir / f"nse_daily_{year}.csv"
    latest_path = out_dir / f"nse_daily_{year}_latest.csv"
    write_csv(full_path, full)

    latest_date = trading_days[-1]
    latest = full[full["date"] == format_display_date(parse_ymd(latest_date))].copy()
    write_csv(latest_path, latest)

    monthly_files: list[str] = []
    for month in sorted(monthly):
        name = f"nse_daily_{year}_{month:02d}.csv"
        write_csv(out_dir / name, pd.concat(monthly[month], ignore_index=True))
        monthly_files.append(name)

    generated_at = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    status = "ok" if not failed else "partial"
    manifest = {
        "year": year,
        "generatedAt": generated_at,
        "status": status,
        "series": [args.series.upper()],
        "startDate": start.isoformat(),
        "endDate": end.isoformat(),
        "latestDate": latest_date,
        "tradingDays": len(trading_days),
        "tradingDayList": trading_days,
        "rowCount": int(len(full)),
        "latestRowCount": int(len(latest)),
        "failedDays": failed,
        "releaseTag": f"nse-daily-{year}",
        "files": {
            "full": full_path.name,
            "latest": latest_path.name,
            "monthly": monthly_files,
        },
        "disclaimer": (
            "Data is sourced from NSE India public reports. "
            "Verify figures on nseindia.com before making decisions."
        ),
    }
    manifest_path = out_dir / "manifest.json"
    manifest_path.write_text(json.dumps(manifest, indent=2), encoding="utf-8")

    if args.frontend_dir:
        frontend_dir: Path = args.frontend_dir
        frontend_dir.mkdir(parents=True, exist_ok=True)
        write_csv(frontend_dir / latest_path.name, latest)
        (frontend_dir / "manifest.json").write_text(
            json.dumps(manifest, indent=2), encoding="utf-8"
        )
        log(f"Copied preview files to {frontend_dir}")

    log(f"Wrote {len(full):,} rows across {len(trading_days)} days -> {full_path}")
    if failed:
        log(f"Completed with {len(failed)} failed day(s).")
    return 0 if status == "ok" else 2


if __name__ == "__main__":
    sys.exit(main())
