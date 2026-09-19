export const EMPTY_FILTERS = {
  query: "",
  minVolume: "",
  minClose: "",
  maxClose: "",
  listedAfter: "",
  listedBefore: "",
};

export function applyRowFilters(rows, filters) {
  const tokens = (filters.query || "")
    .trim()
    .toLowerCase()
    .replaceAll(",", " ")
    .split(/\s+/)
    .filter(Boolean);
  return rows.filter((row) => {
    if (tokens.length) {
      const hay = `${row.Company} ${row.Symbol}`.toLowerCase();
      if (!tokens.some((tok) => hay.includes(tok))) return false;
    }
    const volume = Number(row.Volume);
    if (filters.minVolume !== "" && !(volume >= Number(filters.minVolume))) return false;
    const close = Number(row.Close);
    if (filters.minClose !== "" && !(close >= Number(filters.minClose))) return false;
    if (filters.maxClose !== "" && !(close <= Number(filters.maxClose))) return false;
    const listed = Date.parse(row["Listing Date"] || "");
    if (filters.listedAfter && !(listed >= Date.parse(filters.listedAfter))) return false;
    if (filters.listedBefore && !(listed <= Date.parse(`${filters.listedBefore}T23:59:59`))) {
      return false;
    }
    return true;
  });
}
