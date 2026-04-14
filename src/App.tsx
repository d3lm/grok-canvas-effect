import { Link, Route, Routes, useLocation } from 'react-router';
import { Generator } from './Generator';
import { GrokCanvas } from './GrokCanvas';

export function App() {
  const { pathname } = useLocation();

  return (
    <>
      {pathname !== '/generator' && (
        <nav className="fixed top-4 right-4 z-100">
          <Link
            className="inline-flex items-center gap-1.5 rounded-md bg-white/10 px-3.5 py-1.5 text-[13px] font-medium text-zinc-400 no-underline backdrop-blur-md transition hover:bg-white/15 hover:text-white"
            to="/generator"
          >
            Generator
          </Link>
        </nav>
      )}
      <Routes>
        <Route index element={<GrokCanvas />} />
        <Route path="generator" element={<Generator />} />
      </Routes>
    </>
  );
}
