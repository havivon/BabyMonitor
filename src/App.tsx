import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';

/** Temporary route stub — replaced by real screens (UI engineer). */
function Placeholder({ title }: { title: string }) {
  return (
    <main className="app-placeholder">
      <h1>{title}</h1>
    </main>
  );
}

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<Placeholder title="מעקב האכלה" />} />
        <Route path="/history" element={<Placeholder title="היסטוריה" />} />
        <Route path="/growth" element={<Placeholder title="גדילה" />} />
        <Route path="/stats" element={<Placeholder title="סטטיסטיקה" />} />
        <Route path="/settings" element={<Placeholder title="הגדרות" />} />
        <Route path="/onboarding" element={<Placeholder title="ברוכים הבאים" />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  );
}
