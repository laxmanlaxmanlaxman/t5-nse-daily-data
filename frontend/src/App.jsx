import { NavLink, Route, Routes } from "react-router-dom";
import { DataProvider } from "./data";
import { useDataset } from "./dataset";
import Tip from "./components/Tip.jsx";
import ExportPage from "./pages/ExportPage.jsx";
import HomePage from "./pages/HomePage.jsx";
import PreviewPage from "./pages/PreviewPage.jsx";
import StatusPage from "./pages/StatusPage.jsx";

function Nav() {
  const { qs } = useDataset();
  const previewTo = qs ? { pathname: "/preview", search: qs } : "/preview";
  const exportTo = qs ? { pathname: "/export", search: qs } : "/export";
  const statusTo = qs ? { pathname: "/status", search: qs } : "/status";
  return (
    <nav>
      <Tip text="Home: daily and 1-minute snapshots">
        <NavLink to="/" end>
          Overview
        </NavLink>
      </Tip>
      <Tip text="Look at prices in a table">
        <NavLink to={previewTo}>Preview</NavLink>
      </Tip>
      <Tip text="Download CSV files">
        <NavLink to={exportTo}>Export</NavLink>
      </Tip>
      <Tip text="See whether the last data jobs succeeded">
        <NavLink to={statusTo}>Status</NavLink>
      </Tip>
    </nav>
  );
}

export default function App() {
  return (
    <DataProvider>
      <div className="shell">
        <header className="top">
          <div>
            <p className="kicker">NSE cash market</p>
            <h1>Daily and 1-minute equity data</h1>
          </div>
          <Nav />
        </header>
        <main>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/preview" element={<PreviewPage />} />
            <Route path="/export" element={<ExportPage />} />
            <Route path="/status" element={<StatusPage />} />
          </Routes>
        </main>
        <footer>
          Daily bars from NSE public bhavcopy. Minute bars from a public market-data
          source. Not investment advice.
        </footer>
      </div>
    </DataProvider>
  );
}
