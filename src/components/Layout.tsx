import { Outlet, NavLink, useNavigate } from "react-router-dom";
import { Home, BookOpen, BarChart3, Camera } from "lucide-react";
import { ThemeToggle } from "./ThemeToggle";

function NavItem({ to, icon, label }: { to: string; icon: React.ReactNode; label: string }) {
  return (
    <NavLink
      to={to}
      end={to === "/"}
      className={({ isActive }) =>
        `flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-colors ${
          isActive
            ? "bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400"
            : "text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
        }`
      }
    >
      {icon}
      {label}
    </NavLink>
  );
}

function MobileNavItem({ to, icon, label }: { to: string; icon: React.ReactNode; label: string }) {
  return (
    <NavLink
      to={to}
      end={to === "/"}
      className={({ isActive }) =>
        `flex-1 flex flex-col items-center justify-center py-2 gap-0.5 text-xs font-medium transition-colors ${
          isActive
            ? "text-blue-600 dark:text-blue-400"
            : "text-gray-500 dark:text-gray-400"
        }`
      }
    >
      {icon}
      {label}
    </NavLink>
  );
}

export default function Layout() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex flex-col">
      {/* Top header */}
      <header className="sticky top-0 z-40 bg-white/80 dark:bg-gray-900/80 backdrop-blur border-b border-gray-200 dark:border-gray-800">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          {/* Logo */}
          <NavLink to="/" className="flex items-center gap-2">
            <BookOpen size={22} className="text-blue-500" />
            <span className="font-bold text-gray-900 dark:text-white text-lg tracking-tight">
              My Library
            </span>
          </NavLink>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-1">
            <NavItem to="/" icon={<Home size={16} />} label="Home" />
            <NavItem to="/library" icon={<BookOpen size={16} />} label="Library" />
            <NavItem to="/stats" icon={<BarChart3 size={16} />} label="Stats" />
          </nav>

          {/* Right actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate("/scan")}
              className="flex items-center gap-2 bg-blue-500 hover:bg-blue-600 active:bg-blue-700 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-colors shadow-sm"
            >
              <Camera size={16} />
              <span className="hidden sm:inline">Scan</span>
            </button>
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Page content */}
      <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-6 pb-24 md:pb-8">
        <Outlet />
      </main>

      {/* Mobile bottom nav */}
      <nav
        className="md:hidden fixed bottom-0 inset-x-0 bg-white/90 dark:bg-gray-900/90 backdrop-blur border-t border-gray-200 dark:border-gray-800 z-40"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="flex h-14">
          <MobileNavItem to="/" icon={<Home size={22} />} label="Home" />
          <MobileNavItem to="/library" icon={<BookOpen size={22} />} label="Library" />
          <MobileNavItem to="/scan" icon={<Camera size={22} />} label="Scan" />
          <MobileNavItem to="/stats" icon={<BarChart3 size={22} />} label="Stats" />
        </div>
      </nav>
    </div>
  );
}
