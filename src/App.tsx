import { lazy, Suspense, useEffect } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { useLibraryStore } from "@/store/useLibraryStore";
import { useAuthStore } from "@/store/useAuthStore";
import { ThemeProvider } from "@/utils/theme";
import Layout from "@/components/Layout";
import RequireAuth from "@/components/RequireAuth";
import { registerBuiltinPlugins } from "@/services/plugins";

registerBuiltinPlugins();

// Route-level code splitting — each page is a separate chunk
const Scan = lazy(() => import("@/pages/Scan"));
const Library = lazy(() => import("@/pages/Library"));
const Stats = lazy(() => import("@/pages/Stats"));
const BookDetail = lazy(() => import("@/pages/BookDetail"));
const Settings = lazy(() => import("@/pages/Settings"));
const Login = lazy(() => import("@/pages/Login"));

function PageSpinner() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="w-8 h-8 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
    </div>
  );
}

export default function App() {
  const loadBooks = useLibraryStore((s) => s.loadBooks);
  const loadMe = useAuthStore((s) => s.loadMe);

  useEffect(() => {
    loadMe();
    loadBooks();
  }, [loadMe, loadBooks]);

  return (
    <ThemeProvider>
      <BrowserRouter>
        <Suspense fallback={<PageSpinner />}>
          <Routes>
            {/* Auth + full-screen routes live outside Layout */}
            <Route path="/login" element={<Login />} />
            <Route
              path="/scan"
              element={
                <RequireAuth>
                  <Scan />
                </RequireAuth>
              }
            />

            {/* Everything else shares nav chrome. Browsing is public; writes/settings gated. */}
            <Route element={<Layout />}>
              <Route index element={<Library />} />
              <Route path="/library" element={<Library />} />
              <Route
                path="/book/:id"
                element={
                  <RequireAuth>
                    <BookDetail />
                  </RequireAuth>
                }
              />
              <Route
                path="/stats"
                element={
                  <RequireAuth>
                    <Stats />
                  </RequireAuth>
                }
              />
              <Route
                path="/settings"
                element={
                  <RequireAuth>
                    <Settings />
                  </RequireAuth>
                }
              />
            </Route>
          </Routes>
        </Suspense>
      </BrowserRouter>
    </ThemeProvider>
  );
}
