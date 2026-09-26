import { useMemo, useState } from "react";
import { nextSort, sortMark, sortRows } from "../dataset";
import Tip from "./Tip.jsx";

export default function FileTable({
  files,
  empty = "No files yet.",
  showDownload = true,
  selectable = false,
  selected = [],
  onToggle,
  onToggleAll,
}) {
  const [sort, setSort] = useState({ key: "iso", dir: "desc" });
  const sorted = useMemo(() => sortRows(files, sort), [files, sort]);
  const selectedSet = new Set(selected);
  const allChecked = files.length > 0 && files.every((file) => selectedSet.has(file.name));

  if (!files.length) return <p className="note">{empty}</p>;

  return (
    <div className={`table-wrap file-table${selectable ? " has-check" : ""}`}>
      <table>
        <thead>
          <tr>
            {selectable && (
              <th>
                <input
                  type="checkbox"
                  checked={allChecked}
                  title="Select all files"
                  onChange={() => onToggleAll?.(!allChecked)}
                />
              </th>
            )}
            <th>
              <button type="button" className="sort-btn" title="Sort by date" onClick={() => setSort((current) => nextSort(current, "iso"))}>
                Date
                <span className={`sort-arrow ${sort.key === "iso" ? "on" : ""}`}>{sortMark(sort, "iso")}</span>
              </button>
            </th>
            <th>What’s inside</th>
            <th className="num">
              <button type="button" className="sort-btn" title="Sort by size" onClick={() => setSort((current) => nextSort(current, "size"))}>
                Size
                <span className={`sort-arrow ${sort.key === "size" ? "on" : ""}`}>{sortMark(sort, "size")}</span>
              </button>
            </th>
            {showDownload && <th> </th>}
          </tr>
        </thead>
        <tbody>
          {sorted.map((file) => (
            <tr key={file.name}>
              {selectable && (
                <td>
                  <input
                    type="checkbox"
                    checked={selectedSet.has(file.name)}
                    title={`Include ${file.label}`}
                    onChange={() => onToggle?.(file.name)}
                  />
                </td>
              )}
              <td>{file.label}</td>
              <td>{file.blurb}</td>
              <td className="num">{file.sizeLabel || "—"}</td>
              {showDownload && (
                <td>
                  {file.url ? (
                    <Tip text={`Download the CSV for ${file.label}`}>
                      <a className="button secondary" href={file.url}>
                        Download
                      </a>
                    </Tip>
                  ) : (
                    "—"
                  )}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
