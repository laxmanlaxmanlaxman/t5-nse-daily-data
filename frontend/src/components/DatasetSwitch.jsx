import { useDataset } from "../dataset";
import Tip from "./Tip.jsx";

export default function DatasetSwitch() {
  const { dataset, setDataset } = useDataset();

  return (
    <div className="switch" role="tablist" aria-label="Data type">
      <Tip text="Official NSE daily open, high, low, close and volume">
        <button
          type="button"
          role="tab"
          aria-selected={dataset === "daily"}
          className={dataset === "daily" ? "on" : ""}
          onClick={() => setDataset("daily")}
        >
          Daily (T5)
        </button>
      </Tip>
      <Tip text="1-minute bars collected in the background for every EQ ticker">
        <button
          type="button"
          role="tab"
          aria-selected={dataset === "minute"}
          className={dataset === "minute" ? "on" : ""}
          onClick={() => setDataset("minute")}
        >
          1-minute (T6)
        </button>
      </Tip>
    </div>
  );
}
