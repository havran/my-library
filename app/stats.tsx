import { View, Text, ScrollView, useWindowDimensions, Pressable, Alert, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLibraryStore } from "@/store/useLibraryStore";
import { useTheme } from "@/utils/theme";
import { getGenreCounts } from "@/utils/helpers";
import { ThemeToggle } from "@/components/ThemeToggle";
import { StatsChart } from "@/components/StatsChart";

export default function StatsScreen() {
  const { books } = useLibraryStore();
  const { isDark } = useTheme();
  const { width } = useWindowDimensions();

  const totalBooks = books.length;
  const readBooks = books.filter((b) => b.isRead).length;
  const unreadBooks = totalBooks - readBooks;
  const genreCounts = getGenreCounts(books);
  const topGenres = Object.entries(genreCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);
  const totalPages = books.reduce((sum, b) => sum + (b.pageCount || 0), 0);
  const avgRating =
    books.filter((b) => b.averageRating).length > 0
      ? (
          books
            .filter((b) => b.averageRating)
            .reduce((sum, b) => sum + (b.averageRating || 0), 0) /
          books.filter((b) => b.averageRating).length
        ).toFixed(1)
      : "N/A";

  if (totalBooks === 0) {
    return (
      <View className="flex-1 items-center justify-center bg-gray-50 dark:bg-gray-900 px-6">
        <Ionicons
          name="stats-chart-outline"
          size={64}
          color={isDark ? "#475569" : "#94a3b8"}
        />
        <Text className="text-gray-400 dark:text-gray-500 text-center mt-4 text-lg">
          Add some books to see your stats!
        </Text>
      </View>
    );
  }

  return (
    <ScrollView className="flex-1 bg-gray-50 dark:bg-gray-900 px-4 pt-4">
      {/* Summary Cards */}
      <View className="flex-row flex-wrap gap-3 mb-6">
        <View className="flex-1 min-w-[45%] bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm">
          <Ionicons name="library" size={24} color="#3b82f6" />
          <Text className="text-3xl font-bold text-gray-900 dark:text-white mt-2">
            {totalBooks}
          </Text>
          <Text className="text-gray-500 dark:text-gray-400 text-sm">
            Total Books
          </Text>
        </View>
        <View className="flex-1 min-w-[45%] bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm">
          <Ionicons name="checkmark-circle" size={24} color="#22c55e" />
          <Text className="text-3xl font-bold text-gray-900 dark:text-white mt-2">
            {readBooks}
          </Text>
          <Text className="text-gray-500 dark:text-gray-400 text-sm">
            Books Read
          </Text>
        </View>
        <View className="flex-1 min-w-[45%] bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm">
          <Ionicons name="document-text" size={24} color="#f59e0b" />
          <Text className="text-3xl font-bold text-gray-900 dark:text-white mt-2">
            {totalPages.toLocaleString()}
          </Text>
          <Text className="text-gray-500 dark:text-gray-400 text-sm">
            Total Pages
          </Text>
        </View>
        <View className="flex-1 min-w-[45%] bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm">
          <Ionicons name="star" size={24} color="#a855f7" />
          <Text className="text-3xl font-bold text-gray-900 dark:text-white mt-2">
            {avgRating}
          </Text>
          <Text className="text-gray-500 dark:text-gray-400 text-sm">
            Avg Rating
          </Text>
        </View>
      </View>

      {/* Read vs Unread */}
      <View className="bg-white dark:bg-gray-800 rounded-xl p-4 mb-6 shadow-sm">
        <Text className="text-lg font-bold text-gray-900 dark:text-white mb-3">
          Reading Progress
        </Text>
        <View className="flex-row h-8 rounded-full overflow-hidden bg-gray-200 dark:bg-gray-700">
          {readBooks > 0 && (
            <View
              className="bg-green-500 h-full items-center justify-center"
              style={{ width: `${(readBooks / totalBooks) * 100}%` }}
            >
              {readBooks / totalBooks > 0.15 && (
                <Text className="text-white text-xs font-bold">
                  {readBooks} read
                </Text>
              )}
            </View>
          )}
          {unreadBooks > 0 && (
            <View
              className="bg-gray-300 dark:bg-gray-600 h-full items-center justify-center"
              style={{ width: `${(unreadBooks / totalBooks) * 100}%` }}
            >
              {unreadBooks / totalBooks > 0.15 && (
                <Text className="text-gray-700 dark:text-gray-300 text-xs font-bold">
                  {unreadBooks} unread
                </Text>
              )}
            </View>
          )}
        </View>
      </View>

      {/* Genre Breakdown */}
      {topGenres.length > 0 && (
        <View className="bg-white dark:bg-gray-800 rounded-xl p-4 mb-6 shadow-sm">
          <Text className="text-lg font-bold text-gray-900 dark:text-white mb-3">
            Books by Genre
          </Text>
          <StatsChart genreCounts={genreCounts} width={width - 64} />
          <View className="mt-4">
            {topGenres.map(([genre, count]) => (
              <View
                key={genre}
                className="flex-row justify-between items-center py-2 border-b border-gray-100 dark:border-gray-700"
              >
                <Text className="text-gray-700 dark:text-gray-300 flex-1" numberOfLines={1}>
                  {genre}
                </Text>
                <View className="bg-blue-100 dark:bg-blue-900 rounded-full px-3 py-1 ml-2">
                  <Text className="text-blue-700 dark:text-blue-300 text-sm font-bold">
                    {count}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Export/Import */}
      <View className="bg-white dark:bg-gray-800 rounded-xl p-4 mb-6 shadow-sm">
        <Text className="text-lg font-bold text-gray-900 dark:text-white mb-3">
          Manage Library
        </Text>
        <View className="flex-row gap-3">
          <Pressable
            onPress={async () => {
              try {
                const json = await useLibraryStore.getState().exportBooks();
                if (Platform.OS === "web") {
                  const blob = new Blob([json], { type: "application/json" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `my-library-export-${new Date().toISOString().split("T")[0]}.json`;
                  a.click();
                  URL.revokeObjectURL(url);
                }
                Alert.alert("Exported", `${JSON.parse(json).length} books exported.`);
              } catch (e) {
                Alert.alert("Error", "Failed to export library.");
              }
            }}
            className="flex-1 bg-blue-50 dark:bg-blue-900/30 rounded-xl py-3 items-center flex-row justify-center"
          >
            <Ionicons name="download-outline" size={20} color="#3b82f6" />
            <Text className="text-blue-500 font-bold ml-2">Export JSON</Text>
          </Pressable>
          <Pressable
            onPress={async () => {
              try {
                if (Platform.OS === "web") {
                  const input = document.createElement("input");
                  input.type = "file";
                  input.accept = ".json";
                  input.onchange = async (e: any) => {
                    const file = e.target.files[0];
                    if (file) {
                      const text = await file.text();
                      const count = await useLibraryStore.getState().importBooks(text);
                      Alert.alert("Imported", `${count} books imported.`);
                    }
                  };
                  input.click();
                }
              } catch (e) {
                Alert.alert("Error", "Failed to import library.");
              }
            }}
            className="flex-1 bg-green-50 dark:bg-green-900/30 rounded-xl py-3 items-center flex-row justify-center"
          >
            <Ionicons name="cloud-upload-outline" size={20} color="#22c55e" />
            <Text className="text-green-500 font-bold ml-2">Import JSON</Text>
          </Pressable>
        </View>
        <View className="flex-row items-center justify-between mt-4 pt-3 border-t border-gray-100 dark:border-gray-700">
          <Text className="text-gray-700 dark:text-gray-300">Theme</Text>
          <ThemeToggle />
        </View>
      </View>

      {/* Recent additions */}
      <View className="bg-white dark:bg-gray-800 rounded-xl p-4 mb-8 shadow-sm">
        <Text className="text-lg font-bold text-gray-900 dark:text-white mb-3">
          Recently Added
        </Text>
        {[...books]
          .sort((a, b) => b.addedAt.localeCompare(a.addedAt))
          .slice(0, 5)
          .map((book) => (
            <View
              key={book.id}
              className="flex-row items-center py-2 border-b border-gray-100 dark:border-gray-700"
            >
              <Text
                className="text-gray-900 dark:text-white flex-1 font-medium"
                numberOfLines={1}
              >
                {book.title}
              </Text>
              <Text className="text-gray-400 dark:text-gray-500 text-xs ml-2">
                {new Date(book.addedAt).toLocaleDateString()}
              </Text>
            </View>
          ))}
      </View>
    </ScrollView>
  );
}
