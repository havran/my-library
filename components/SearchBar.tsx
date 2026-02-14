import { View, TextInput } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/utils/theme";

interface Props {
  value: string;
  onChangeText: (text: string) => void;
}

export function SearchBar({ value, onChangeText }: Props) {
  const { isDark } = useTheme();

  return (
    <View className="flex-row items-center bg-white dark:bg-gray-800 rounded-xl px-3 py-2 mb-3">
      <Ionicons
        name="search"
        size={20}
        color={isDark ? "#94a3b8" : "#64748b"}
      />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder="Search books..."
        placeholderTextColor={isDark ? "#64748b" : "#94a3b8"}
        className="flex-1 ml-2 text-gray-900 dark:text-white py-1"
      />
    </View>
  );
}
