import { lazy, Suspense, useEffect } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { useLibraryStore } from "@/store/useLibraryStore";
import { ThemeProvider } from "@/utils/theme";
import Layout from "@/components/Layout";

// Route-level code splitting — each page is a separate chunk
const Home       = lazy(() => import("@/pages/Home"));
const Scan       = lazy(() => import("@/pages/Scan"));
const Library    = lazy(() => import("@/pages/Library"));
const Stats      = lazy(() => import("@/pages/Stats"));
const BookDetail = lazy(() => import("@/pages/BookDetail"));

function PageSpinner() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="w-8 h-8 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
    </div>
  );
}

export default function App() {
  const { loadBooks } = useLibraryStore();

  useEffect(() => {
    loadBooks();
  }, [loadBooks]);

  return (
    <ThemeProvider>
      <BrowserRouter>
        <Suspense fallback={<PageSpinner />}>
          <Routes>
            {/* Full-screen scanner — no layout chrome */}
            <Route path="/scan" element={<Scan />} />

            {/* All other pages share the nav layout */}
            <Route element={<Layout />}>
              <Route index element={<Home />} />
              <Route path="/library" element={<Library />} />
              <Route path="/stats" element={<Stats />} />
              <Route path="/book/:id" element={<BookDetail />} />
            </Route>
          </Routes>
        </Suspense>
      </BrowserRouter>
    </ThemeProvider>
  );
}
