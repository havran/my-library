import { View, Text, Image, Pressable, Modal } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/utils/theme";
import type { BookSearchResult } from "@/types/book";

interface Props {
  data: BookSearchResult;
  onAdd: () => void;
  onCancel: () => void;
}

export function BookPreview({ data, onAdd, onCancel }: Props) {
  const { isDark } = useTheme();

  return (
    <Modal visible transparent animationType="fade">
      <View className="flex-1 bg-black/50 justify-center items-center px-6">
        <View className="bg-white dark:bg-gray-800 rounded-2xl p-6 w-full max-w-sm shadow-xl">
          <View className="items-center">
            {data.coverUrl ? (
              <Image
                source={{ uri: data.coverUrl }}
                className="w-32 h-48 rounded-lg"
                resizeMode="cover"
              />
            ) : (
              <View className="w-32 h-48 rounded-lg bg-gray-200 dark:bg-gray-700 items-center justify-center">
                <Ionicons
                  name="book"
                  size={40}
                  color={isDark ? "#94a3b8" : "#64748b"}
                />
              </View>
            )}
            <Text className="text-xl font-bold text-gray-900 dark:text-white mt-4 text-center">
              {data.title}
            </Text>
            <Text className="text-gray-500 dark:text-gray-400 mt-1 text-center">
              {data.authors.join(", ") || "Unknown Author"}
            </Text>
            {data.publisher && (
              <Text className="text-gray-400 dark:text-gray-500 text-sm mt-1">
                {data.publisher}
              </Text>
            )}
            {data.genres.length > 0 && (
              <View className="flex-row flex-wrap justify-center gap-1 mt-2">
                {data.genres.slice(0, 3).map((g) => (
                  <View
                    key={g}
                    className="bg-blue-100 dark:bg-blue-900 rounded px-2 py-0.5"
                  >
                    <Text className="text-xs text-blue-700 dark:text-blue-300">
                      {g}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </View>

          <View className="flex-row gap-3 mt-6">
            <Pressable
              onPress={onCancel}
              className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-xl py-3 items-center"
            >
              <Text className="text-gray-900 dark:text-white font-medium">
                Cancel
              </Text>
            </Pressable>
            <Pressable
              onPress={onAdd}
              className="flex-1 bg-blue-500 active:bg-blue-600 rounded-xl py-3 items-center"
            >
              <Text className="text-white font-bold">Add to Library</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
