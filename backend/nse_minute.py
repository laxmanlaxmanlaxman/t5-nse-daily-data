#!/usr/bin/env python3
"""T6 background collector for NSE equity minute bars.

NSE does not publish 10 years of 1-minute bars for all tickers for free.
Yahoo Finance typically serves about 7 calendar days of 1-minute data per
request (roughly 30 days of history at most). This job therefore:

1. Loads the official NSE EQUITY_L ticker list.
2. Pulls the latest 1-minute window for every EQ ticker.
3. Keeps only bars newer than the last successful run.
4. Writes a CSV plus t6_status.json for the Status page.

It accumulates a forward archive. It cannot reconstruct a 10-year 1-minute
history that public free sources do not provide.
"""

from __future__ import annotations

import argparse
import json
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd
import yfinance as yf

sys.path.insert(0, str(Path(__file__).resolve().parent))
from nse_daily import OUTPUT_COLUMNS, build_session, format_display_date, load_equity_master

LOOKBACK_NOTE = (
    "NSE does not publish 10 years of 1-minute bars for free. "
    "Yahoo Finance typically serves about 7 days of 1-minute data per request. "
    "This passive job collects that window for every EQ ticker each night and "
    "keeps only new minutes, so a forward archive grows over time. "
    "A full 10-year 1-minute backfill is not available from public free sources."
)
TZ = "Asia/Kolkata"


def log(message: str) -> None:
    print(message, flush=True)


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="T6 NSE minute collector.")
    parser.add_argument("--out", type=Path, default=Path("output/t6"))
    parser.add_argument("--frontend-dir", type=Path, default=Path("frontend/public/data"))
    parser.add_argument("--status-in", type=Path, default=Path("frontend/public/data/t6_status.json"))
    parser.add_argument("--batch-size", type=int, default=40)
    parser.add_argument("--sleep", type=float, default=1.5)
    parser.add_argument("--period", type=str, default="7d")
    parser.add_argument("--max-symbols", type=int, default=0, help="0 means all EQ tickers")
    return parser.parse_args(argv)


def load_status(path: Path) -> dict:
    if not path.exists():
        return {}
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return {}


def parse_watermark(value: str | None) -> pd.Timestamp | None:
    if not value:
        return None
    stamp = pd.to_datetime(value, utc=True, errors="coerce")
    if pd.isna(stamp):
        return None
    return stamp


def flatten_download(data: pd.DataFrame, yahoo_symbols: list[str]) -> pd.DataFrame:
    if data is None or data.empty:
        return pd.DataFrame()
    frames: list[pd.DataFrame] = []
    if isinstance(data.columns, pd.MultiIndex):
        level0 = set(data.columns.get_level_values(0))
        for ys in yahoo_symbols:
            if ys not in level0:
                continue
            part = data[ys].copy().dropna(how="all")
            if part.empty:
                continue
            part = part.reset_index()
            part["Yahoo"] = ys
            frames.append(part)
    else:
        part = data.dropna(how="all").copy().reset_index()
        part["Yahoo"] = yahoo_symbols[0]
        frames.append(part)
    if not frames:
        return pd.DataFrame()
    return pd.concat(frames, ignore_index=True)


def normalize_minutes(raw: pd.DataFrame, master: pd.DataFrame, watermark: pd.Timestamp | None) -> pd.DataFrame:
    if raw.empty:
        return raw
    time_col = "Datetime" if "Datetime" in raw.columns else raw.columns[0]
    frame = raw.rename(columns={time_col: "Datetime"})
    frame["Datetime"] = pd.to_datetime(frame["Datetime"], utc=True, errors="coerce")
    frame = frame.dropna(subset=["Datetime"])
    if watermark is not None:
        frame = frame[frame["Datetime"] > watermark]
    if frame.empty:
        return frame

    for col in ("Open", "High", "Low", "Close", "Volume"):
        if col not in frame.columns:
            frame[col] = pd.NA
        frame[col] = pd.to_numeric(frame[col], errors="coerce")
    frame = frame.dropna(subset=["Open", "High", "Low", "Close"])
    frame["Symbol"] = frame["Yahoo"].astype(str).str.replace(r"\.NS$", "", regex=True).str.upper()
    merged = frame.merge(master, on="Symbol", how="left")
    merged["Company"] = merged["Company"].fillna("").astype(str)
    merged["Listing Date"] = merged["Listing Date"].map(format_display_date)
    merged["Interval"] = "1m"
    local = merged["Datetime"].dt.tz_convert(TZ)
    merged["date"] = local.dt.strftime("%Y-%m-%d %H:%M:%S")
    out = merged[OUTPUT_COLUMNS + ["Datetime"]].copy()
    return out.sort_values(["date", "Symbol"], kind="mergesort").reset_index(drop=True)


def download_batch(yahoo_symbols: list[str], period: str) -> pd.DataFrame:
    data = yf.download(
        tickers=yahoo_symbols,
        interval="1m",
        period=period,
        group_by="ticker",
        auto_adjust=False,
        threads=True,
        progress=False,
    )
    return flatten_download(data, yahoo_symbols)


def download_one(symbol: str, period: str) -> pd.DataFrame:
    yahoo = f"{symbol}.NS"
    data = yf.download(
        tickers=yahoo,
        interval="1m",
        period=period,
        auto_adjust=False,
        progress=False,
        threads=False,
    )
    return flatten_download(data, [yahoo])


def write_status(path: Path, payload: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2), encoding="utf-8")


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    out_dir: Path = args.out
    out_dir.mkdir(parents=True, exist_ok=True)

    previous = load_status(args.status_in)
    watermark = parse_watermark(previous.get("lastMinuteUtc"))

    log("T6 minute collector starting")
    session = build_session()
    master = load_equity_master(session)
    symbols = master["Symbol"].dropna().astype(str).str.strip().str.upper().tolist()
    symbols = [sym for sym in symbols if sym]
    if args.max_symbols and args.max_symbols > 0:
        symbols = symbols[: args.max_symbols]
    log(f"EQ symbols: {len(symbols):,}  period={args.period}  watermark={watermark}")

    failed: list[str] = []
    ok_count = 0
    new_rows = 0
    last_minute = watermark
    csv_name = f"nse_1m_{datetime.now(timezone.utc).strftime('%Y-%m-%d')}.csv"
    csv_path = out_dir / csv_name
    if csv_path.exists():
        csv_path.unlink()

    batch_size = max(1, args.batch_size)
    for index in range(0, len(symbols), batch_size):
        batch = symbols[index : index + batch_size]
        yahoo = [f"{sym}.NS" for sym in batch]
        log(f"  batch {index // batch_size + 1}: {batch[0]} .. {batch[-1]} ({len(batch)})")
        raw = pd.DataFrame()
        try:
            raw = download_batch(yahoo, args.period)
        except Exception as exc:  # noqa: BLE001
            log(f"    batch error: {exc}; retrying one by one")
            raw = pd.DataFrame()

        if raw.empty:
            parts = []
            for sym in batch:
                try:
                    part = download_one(sym, args.period)
                    if not part.empty:
                        parts.append(part)
                except Exception as one_exc:  # noqa: BLE001
                    failed.append(sym)
                    log(f"    {sym}: {one_exc}")
                time.sleep(0.2)
            raw = pd.concat(parts, ignore_index=True) if parts else pd.DataFrame()

        if not raw.empty and "Yahoo" in raw.columns:
            got = set(
                raw["Yahoo"].astype(str).str.replace(r"\.NS$", "", regex=True).str.upper()
            )
            ok_count += len(got)

        mapped = normalize_minutes(raw, master, watermark)
        if not mapped.empty:
            dump = mapped.drop(columns=["Datetime"])
            write_header = not csv_path.exists()
            dump.to_csv(csv_path, index=False, mode="a", header=write_header)
            new_rows += len(dump)
            batch_last = mapped["Datetime"].max()
            if last_minute is None or batch_last > last_minute:
                last_minute = batch_last
            log(f"    kept {len(dump):,} new minutes")
        time.sleep(args.sleep)

    generated_at = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    last_minute_iso = None
    if last_minute is not None:
        stamp = pd.Timestamp(last_minute)
        if stamp.tzinfo is None:
            stamp = stamp.tz_localize("UTC")
        else:
            stamp = stamp.tz_convert("UTC")
        last_minute_iso = stamp.strftime("%Y-%m-%dT%H:%M:%SZ")
    status = "ok" if new_rows else "idle"
    if failed and new_rows:
        status = "partial"
    if failed and not new_rows and ok_count == 0:
        status = "error"

    payload = {
        "task": "T6",
        "status": status,
        "mode": "background",
        "generatedAt": generated_at,
        "symbolsAttempted": len(symbols),
        "symbolsOk": ok_count,
        "symbolsFailed": len(failed),
        "newRows": int(new_rows),
        "lastMinuteUtc": last_minute_iso,
        "releaseTag": "t6-minute",
        "fileName": csv_name if csv_path.exists() else None,
        "period": args.period,
        "interval": "1m",
        "source": "Yahoo Finance via yfinance (.NS); ticker list from NSE EQUITY_L",
        "note": LOOKBACK_NOTE,
        "failedSymbols": failed[:40],
        "disclaimer": (
            "Minute bars are collected in the background from a public market-data "
            "source. They are not an official NSE 1-minute archive. Verify on "
            "nseindia.com before making decisions."
        ),
    }
    write_status(out_dir / "t6_status.json", payload)
    if args.frontend_dir:
        write_status(args.frontend_dir / "t6_status.json", payload)

    log(f"T6 done status={status} newRows={new_rows:,} file={payload['fileName']}")
    if status == "error":
        return 2
    return 0


if __name__ == "__main__":
    sys.exit(main())
