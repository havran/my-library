import { View, Text, Pressable, ScrollView, Image } from "react-native";
import { useRouter } from "expo-router";
import { useLibraryStore } from "@/store/useLibraryStore";
import { useTheme } from "@/utils/theme";
import { Ionicons } from "@expo/vector-icons";
import { ThemeToggle } from "@/components/ThemeToggle";

export default function HomeScreen() {
  const router = useRouter();
  const { books } = useLibraryStore();
  const { isDark } = useTheme();

  const recentBooks = [...books]
    .sort((a, b) => b.addedAt.localeCompare(a.addedAt))
    .slice(0, 5);

  const totalBooks = books.length;
  const readBooks = books.filter((b) => b.isRead).length;
  const genres = new Set(books.flatMap((b) => b.genres));

  return (
    <ScrollView className="flex-1 bg-gray-50 dark:bg-gray-900">
      <View className="items-center px-6 pt-12 pb-6">
        <View className="absolute right-4 top-4">
          <ThemeToggle />
        </View>

        <Ionicons
          name="library"
          size={64}
          color={isDark ? "#60a5fa" : "#3b82f6"}
        />
        <Text className="text-3xl font-bold text-gray-900 dark:text-white mt-4">
          My Library
        </Text>
        <Text className="text-gray-500 dark:text-gray-400 mt-1">
          Your personal book collection
        </Text>

        <Pressable
          onPress={() => router.push("/scan")}
          className="bg-blue-500 active:bg-blue-600 rounded-2xl px-10 py-5 mt-8 shadow-lg flex-row items-center"
        >
          <Ionicons name="camera" size={28} color="white" />
          <Text className="text-white text-xl font-bold ml-3">Scan Book</Text>
        </Pressable>

        <View className="flex-row mt-8 gap-4 w-full">
          <View className="flex-1 bg-white dark:bg-gray-800 rounded-xl p-4 items-center shadow-sm">
            <Text className="text-2xl font-bold text-blue-500">
              {totalBooks}
            </Text>
            <Text className="text-gray-500 dark:text-gray-400 text-sm">
              Books
            </Text>
          </View>
          <View className="flex-1 bg-white dark:bg-gray-800 rounded-xl p-4 items-center shadow-sm">
            <Text className="text-2xl font-bold text-green-500">
              {readBooks}
            </Text>
            <Text className="text-gray-500 dark:text-gray-400 text-sm">
              Read
            </Text>
          </View>
          <View className="flex-1 bg-white dark:bg-gray-800 rounded-xl p-4 items-center shadow-sm">
            <Text className="text-2xl font-bold text-purple-500">
              {genres.size}
            </Text>
            <Text className="text-gray-500 dark:text-gray-400 text-sm">
              Genres
            </Text>
          </View>
        </View>
      </View>

      {recentBooks.length > 0 && (
        <View className="px-6 pb-8">
          <Text className="text-lg font-bold text-gray-900 dark:text-white mb-3">
            Recently Added
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {recentBooks.map((book) => (
              <Pressable
                key={book.id}
                onPress={() => router.push(`/book/${book.id}`)}
                className="mr-4 w-28"
              >
                {book.coverBase64 || book.coverUrl ? (
                  <Image
                    source={{ uri: book.coverBase64 || book.coverUrl }}
                    className="w-28 h-40 rounded-lg"
                    resizeMode="cover"
                  />
                ) : (
                  <View className="w-28 h-40 rounded-lg bg-gray-200 dark:bg-gray-700 items-center justify-center">
                    <Ionicons
                      name="book"
                      size={32}
                      color={isDark ? "#94a3b8" : "#64748b"}
                    />
                  </View>
                )}
                <Text
                  className="text-xs text-gray-900 dark:text-white mt-1 font-medium"
                  numberOfLines={2}
                >
                  {book.title}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      )}

      {totalBooks === 0 && (
        <View className="items-center px-6 py-8">
          <Ionicons
            name="book-outline"
            size={48}
            color={isDark ? "#475569" : "#94a3b8"}
          />
          <Text className="text-gray-400 dark:text-gray-500 text-center mt-4">
            Your library is empty.{"\n"}Scan a book to get started!
          </Text>
        </View>
      )}
    </ScrollView>
  );
}
