import { Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/utils/theme";

export function ThemeToggle() {
  const { isDark, toggleTheme } = useTheme();

  return (
    <Pressable
      onPress={toggleTheme}
      className="bg-white dark:bg-gray-800 rounded-full p-2.5 shadow-sm"
      accessibilityLabel={`Switch to ${isDark ? "light" : "dark"} mode`}
    >
      <Ionicons
        name={isDark ? "sunny" : "moon"}
        size={22}
        color={isDark ? "#fbbf24" : "#6366f1"}
      />
    </Pressable>
  );
}
