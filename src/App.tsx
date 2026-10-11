import { Navigate, Route, Routes } from "react-router-dom";

import Layout from "@/components/Layout";
import HistoryPage from "@/pages/History";
import PracticePage from "@/pages/Practice";
import StatsPage from "@/pages/Stats";
import WritePage from "@/pages/Write";

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<WritePage />} />
        <Route path="historial" element={<HistoryPage />} />
        <Route path="estadisticas" element={<StatsPage />} />
        <Route path="practicar" element={<PracticePage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
