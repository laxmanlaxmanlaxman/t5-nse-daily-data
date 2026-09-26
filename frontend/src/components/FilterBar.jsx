export default function FilterBar({ filters, onChange, showMore, onToggleMore }) {
  function set(field, value) {
    onChange({ ...filters, [field]: value });
  }

  return (
    <div className="filter-bar">
      <label>
        Company or symbol
        <input
          type="search"
          placeholder="RELIANCE, TCS, Infosys"
          title="Type a company name or ticker. You can enter more than one."
          value={filters.query}
          onChange={(event) => set("query", event.target.value)}
        />
      </label>
      <button
        type="button"
        className="more-toggle"
        title="Volume, price band, and listing-date filters"
        onClick={onToggleMore}
      >
        {showMore ? "Hide extra filters" : "More filters"}
      </button>
      {showMore && (
        <div className="extra-filters">
          <label>
            Min volume
            <input
              type="number"
              min="0"
              placeholder="e.g. 100000"
              value={filters.minVolume}
              onChange={(event) => set("minVolume", event.target.value)}
            />
          </label>
          <label>
            Min close
            <input
              type="number"
              min="0"
              step="0.01"
              placeholder="e.g. 100"
              value={filters.minClose}
              onChange={(event) => set("minClose", event.target.value)}
            />
          </label>
          <label>
            Max close
            <input
              type="number"
              min="0"
              step="0.01"
              placeholder="e.g. 5000"
              value={filters.maxClose}
              onChange={(event) => set("maxClose", event.target.value)}
            />
          </label>
          <label>
            Listed after
            <input
              type="date"
              value={filters.listedAfter}
              onChange={(event) => set("listedAfter", event.target.value)}
            />
          </label>
          <label>
            Listed before
            <input
              type="date"
              value={filters.listedBefore}
              onChange={(event) => set("listedBefore", event.target.value)}
            />
          </label>
        </div>
      )}
    </div>
  );
}
