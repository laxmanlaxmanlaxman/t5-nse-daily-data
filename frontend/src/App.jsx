import { NavLink, Route, Routes } from "react-router-dom";
import { DataProvider } from "./data";
import ExportPage from "./pages/ExportPage.jsx";
import HomePage from "./pages/HomePage.jsx";
import PreviewPage from "./pages/PreviewPage.jsx";
import StatusPage from "./pages/StatusPage.jsx";

export default function App() {
  return (
    <DataProvider>
      <div className="shell">
        <header className="top">
          <div>
            <p className="kicker">T5 · NSE cash market</p>
            <h1>Daily equity data, 2026</h1>
          </div>
          <nav>
            <NavLink to="/" end>
              Overview
            </NavLink>
            <NavLink to="/preview">Preview</NavLink>
            <NavLink to="/export">Export</NavLink>
            <NavLink to="/status">Status</NavLink>
          </nav>
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
          Sourced from NSE India public bhavcopy reports. Not investment advice.
        </footer>
      </div>
    </DataProvider>
  );
}
