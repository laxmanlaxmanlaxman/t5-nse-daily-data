import { useMemo, useState } from "react";
import { formatNumber } from "../data";
import { nextSort, sortMark, sortRows } from "../dataset";

const COLUMNS = [
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
];
const NUMS = new Set(["Open", "High", "Low", "Close", "Volume"]);
const SORTABLE = new Set(["Company", "Symbol", "Listing Date", "Open", "High", "Low", "Close", "Volume", "date"]);

export default function PriceTable({ rows }) {
  const [sort, setSort] = useState({ key: "Symbol", dir: "asc" });
  const sorted = useMemo(() => sortRows(rows, sort), [rows, sort]);

  if (!rows.length) return null;

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            {COLUMNS.map((col) => (
              <th key={col} className={NUMS.has(col) ? "num" : ""}>
                {SORTABLE.has(col) ? (
                  <button
                    type="button"
                    className="sort-btn"
                    title={`Sort by ${col}`}
                    onClick={() => setSort((current) => nextSort(current, col))}
                  >
                    {col}
                    <span className={`sort-arrow ${sort.key === col ? "on" : ""}`}>{sortMark(sort, col)}</span>
                  </button>
                ) : (
                  col
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((row, index) => (
            <tr key={`${row.Symbol}-${row.date}-${index}`}>
              {COLUMNS.map((col) => (
                <td key={col} className={NUMS.has(col) ? "num" : ""}>
                  {NUMS.has(col) ? formatNumber(row[col]) : row[col]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
