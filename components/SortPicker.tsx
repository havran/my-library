import { View, Text, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/utils/theme";
import type { BookSortField, SortDirection } from "@/types/book";

interface Props {
  sortField: BookSortField;
  sortDirection: SortDirection;
  onSortFieldChange: (field: BookSortField) => void;
  onSortDirectionChange: (dir: SortDirection) => void;
}

const fields: { value: BookSortField; label: string }[] = [
  { value: "addedAt", label: "Date" },
  { value: "title", label: "Title" },
  { value: "authors", label: "Author" },
  { value: "genres", label: "Genre" },
];

export function SortPicker({
  sortField,
  sortDirection,
  onSortFieldChange,
  onSortDirectionChange,
}: Props) {
  const { isDark } = useTheme();

  return (
    <View className="flex-row items-center mb-3 gap-2">
      <Text className="text-gray-500 dark:text-gray-400 text-sm">Sort:</Text>
      {fields.map((f) => (
        <Pressable
          key={f.value}
          onPress={() => onSortFieldChange(f.value)}
          className={`px-3 py-1.5 rounded-lg ${
            sortField === f.value
              ? "bg-blue-500"
              : "bg-white dark:bg-gray-800"
          }`}
        >
          <Text
            className={`text-sm font-medium ${
              sortField === f.value
                ? "text-white"
                : "text-gray-600 dark:text-gray-300"
            }`}
          >
            {f.label}
          </Text>
        </Pressable>
      ))}
      <Pressable
        onPress={() =>
          onSortDirectionChange(sortDirection === "asc" ? "desc" : "asc")
        }
        className="ml-auto"
      >
        <Ionicons
          name={sortDirection === "asc" ? "arrow-up" : "arrow-down"}
          size={20}
          color={isDark ? "#94a3b8" : "#64748b"}
        />
      </Pressable>
    </View>
  );
}
