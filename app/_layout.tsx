import "../global.css";
import { useEffect, useState } from "react";
import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { View } from "react-native";
import { ThemeContext } from "@/utils/theme";
import { useLibraryStore } from "@/store/useLibraryStore";

export default function RootLayout() {
  const { theme, toggleTheme, setTheme, loadBooks } = useLibraryStore();
  const isDark = theme === "dark";

  useEffect(() => {
    try {
      const saved = localStorage.getItem("my-library-theme");
      if (saved === "dark" || saved === "light") {
        setTheme(saved);
      }
    } catch {}
    loadBooks();
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, isDark }}>
      <View className={`flex-1 ${isDark ? "dark" : ""}`}>
        <View className="flex-1 bg-gray-50 dark:bg-gray-900">
          <Tabs
            screenOptions={{
              headerStyle: {
                backgroundColor: isDark ? "#1e293b" : "#ffffff",
              },
              headerTintColor: isDark ? "#f1f5f9" : "#1e293b",
              tabBarStyle: {
                backgroundColor: isDark ? "#1e293b" : "#ffffff",
                borderTopColor: isDark ? "#334155" : "#e2e8f0",
              },
              tabBarActiveTintColor: "#3b82f6",
              tabBarInactiveTintColor: isDark ? "#94a3b8" : "#64748b",
            }}
          >
            <Tabs.Screen
              name="index"
              options={{
                title: "Home",
                tabBarIcon: ({ color, size }) => (
                  <Ionicons name="home" size={size} color={color} />
                ),
              }}
            />
            <Tabs.Screen
              name="scan"
              options={{
                title: "Scan",
                tabBarIcon: ({ color, size }) => (
                  <Ionicons name="camera" size={size} color={color} />
                ),
              }}
            />
            <Tabs.Screen
              name="library"
              options={{
                title: "Library",
                tabBarIcon: ({ color, size }) => (
                  <Ionicons name="library" size={size} color={color} />
                ),
              }}
            />
            <Tabs.Screen
              name="stats"
              options={{
                title: "Stats",
                tabBarIcon: ({ color, size }) => (
                  <Ionicons name="stats-chart" size={size} color={color} />
                ),
              }}
            />
            <Tabs.Screen
              name="book/[id]"
              options={{
                href: null,
                title: "Book Details",
              }}
            />
          </Tabs>
        </View>
      </View>
    </ThemeContext.Provider>
  );
}
