import { useState, useMemo } from "react";
import {
  View,
  Text,
  FlatList,
  Pressable,
  Image,
  useWindowDimensions,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useLibraryStore } from "@/store/useLibraryStore";
import { useTheme } from "@/utils/theme";
import { filterBooks, sortBooks } from "@/utils/helpers";
import { SearchBar } from "@/components/SearchBar";
import { SortPicker } from "@/components/SortPicker";
import { EmptyState } from "@/components/EmptyState";
import type { Book } from "@/types/book";

export default function LibraryScreen() {
  const {
    books,
    searchQuery,
    setSearchQuery,
    sortField,
    sortDirection,
    setSortField,
    setSortDirection,
    deleteBook,
    loadBooks,
  } = useLibraryStore();
  const { isDark } = useTheme();
  const router = useRouter();
  const { width } = useWindowDimensions();

  const numColumns = width > 900 ? 4 : width > 600 ? 3 : 2;
  const cardWidth = (width - 32 - (numColumns - 1) * 12) / numColumns;

  const displayBooks = useMemo(() => {
    const filtered = filterBooks(books, searchQuery);
    return sortBooks(filtered, sortField, sortDirection);
  }, [books, searchQuery, sortField, sortDirection]);

  const handleDelete = (book: Book) => {
    Alert.alert("Delete Book", `Remove "${book.title}" from your library?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => deleteBook(book.id),
      },
    ]);
  };

  const renderBook = ({ item }: { item: Book }) => (
    <Pressable
      onPress={() => router.push(`/book/${item.id}`)}
      onLongPress={() => handleDelete(item)}
      className="bg-white dark:bg-gray-800 rounded-xl overflow-hidden shadow-sm mb-3"
      style={{ width: cardWidth, marginRight: 12 }}
    >
      {item.coverBase64 || item.coverUrl ? (
        <Image
          source={{ uri: item.coverBase64 || item.coverUrl }}
          style={{ width: cardWidth, height: cardWidth * 1.4 }}
          resizeMode="cover"
        />
      ) : (
        <View
          style={{ width: cardWidth, height: cardWidth * 1.4 }}
          className="bg-gray-200 dark:bg-gray-700 items-center justify-center"
        >
          <Ionicons
            name="book"
            size={40}
            color={isDark ? "#94a3b8" : "#64748b"}
          />
        </View>
      )}
      <View className="p-2">
        <Text
          className="text-sm font-bold text-gray-900 dark:text-white"
          numberOfLines={2}
        >
          {item.title}
        </Text>
        <Text
          className="text-xs text-gray-500 dark:text-gray-400 mt-0.5"
          numberOfLines={1}
        >
          {item.authors.join(", ")}
        </Text>
        <View className="flex-row items-center mt-1 flex-wrap gap-1">
          {item.genres.slice(0, 2).map((g) => (
            <View
              key={g}
              className="bg-blue-100 dark:bg-blue-900 rounded px-1.5 py-0.5"
            >
              <Text className="text-[10px] text-blue-700 dark:text-blue-300">
                {g}
              </Text>
            </View>
          ))}
          {item.isRead && (
            <Ionicons name="checkmark-circle" size={14} color="#22c55e" />
          )}
        </View>
      </View>
    </Pressable>
  );

  if (books.length === 0) {
    return <EmptyState />;
  }

  return (
    <View className="flex-1 bg-gray-50 dark:bg-gray-900">
      <View className="px-4 pt-4">
        <SearchBar value={searchQuery} onChangeText={setSearchQuery} />
        <SortPicker
          sortField={sortField}
          sortDirection={sortDirection}
          onSortFieldChange={setSortField}
          onSortDirectionChange={setSortDirection}
        />
      </View>

      <FlatList
        data={displayBooks}
        renderItem={renderBook}
        keyExtractor={(item) => item.id}
        numColumns={numColumns}
        key={numColumns}
        contentContainerStyle={{ padding: 16 }}
        columnWrapperStyle={numColumns > 1 ? { gap: 0 } : undefined}
        onRefresh={loadBooks}
        refreshing={false}
        ListEmptyComponent={
          <View className="items-center py-12">
            <Text className="text-gray-400 dark:text-gray-500">
              No books match your search.
            </Text>
          </View>
        }
      />
    </View>
  );
}
