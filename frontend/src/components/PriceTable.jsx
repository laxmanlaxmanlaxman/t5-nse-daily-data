import { formatNumber } from "../data";

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

export default function PriceTable({ rows }) {
  if (!rows.length) return null;
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            {COLUMNS.map((col) => (
              <th key={col}>{col}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
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
