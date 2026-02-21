import { createContext, useContext, useEffect, type ReactNode } from "react";
import { useLibraryStore } from "@/store/useLibraryStore";

interface ThemeContextType {
  theme: "light" | "dark";
  isDark: boolean;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: "light",
  isDark: false,
  toggleTheme: () => {},
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const { theme, toggleTheme } = useLibraryStore();
  const isDark = theme === "dark";

  // Sync dark class on <html> so Tailwind darkMode: 'class' works
  useEffect(() => {
    const root = document.documentElement;
    if (isDark) {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
  }, [isDark]);

  return (
    <ThemeContext.Provider value={{ theme, isDark, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
