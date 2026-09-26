import Tip from "./Tip.jsx";

export default function FileTable({ files, empty = "No files yet.", showDownload = true }) {
  if (!files.length) return <p className="note">{empty}</p>;

  return (
    <div className="table-wrap file-table">
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>What’s inside</th>
            <th className="num">Size</th>
            {showDownload && <th> </th>}
          </tr>
        </thead>
        <tbody>
          {files.map((file) => (
            <tr key={file.name}>
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
