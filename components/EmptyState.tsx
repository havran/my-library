import { View, Text, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/utils/theme";

export function EmptyState() {
  const router = useRouter();
  const { isDark } = useTheme();

  return (
    <View className="flex-1 items-center justify-center bg-gray-50 dark:bg-gray-900 px-6">
      <Ionicons
        name="library-outline"
        size={80}
        color={isDark ? "#475569" : "#cbd5e1"}
      />
      <Text className="text-xl font-bold text-gray-400 dark:text-gray-500 mt-6">
        Your library is empty
      </Text>
      <Text className="text-gray-400 dark:text-gray-500 text-center mt-2">
        Start by scanning a book barcode or adding one manually.
      </Text>
      <Pressable
        onPress={() => router.push("/scan")}
        className="bg-blue-500 active:bg-blue-600 rounded-xl px-8 py-3 mt-6 flex-row items-center"
      >
        <Ionicons name="add" size={20} color="white" />
        <Text className="text-white font-bold ml-1">Add Your First Book</Text>
      </Pressable>
    </View>
  );
}
