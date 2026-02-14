import { View, Text } from "react-native";
import { useTheme } from "@/utils/theme";

interface Props {
  genreCounts: Record<string, number>;
  width: number;
}

const COLORS = [
  "#3b82f6",
  "#22c55e",
  "#f59e0b",
  "#ef4444",
  "#a855f7",
  "#06b6d4",
  "#f97316",
  "#ec4899",
];

export function StatsChart({ genreCounts, width }: Props) {
  const { isDark } = useTheme();
  const entries = Object.entries(genreCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);

  const total = entries.reduce((sum, [, count]) => sum + count, 0);
  if (total === 0) return null;

  return (
    <View>
      {/* Simple horizontal bar chart */}
      {entries.map(([genre, count], i) => {
        const percentage = (count / total) * 100;
        return (
          <View key={genre} className="mb-2">
            <View className="flex-row justify-between mb-1">
              <Text
                className="text-sm text-gray-700 dark:text-gray-300 flex-1"
                numberOfLines={1}
              >
                {genre}
              </Text>
              <Text className="text-sm text-gray-500 dark:text-gray-400 ml-2">
                {Math.round(percentage)}%
              </Text>
            </View>
            <View className="h-6 rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden">
              <View
                className="h-full rounded-full items-center justify-center"
                style={{
                  width: `${Math.max(percentage, 5)}%`,
                  backgroundColor: COLORS[i % COLORS.length],
                }}
              >
                {percentage > 15 && (
                  <Text className="text-white text-xs font-bold">{count}</Text>
                )}
              </View>
            </View>
          </View>
        );
      })}
    </View>
  );
}
