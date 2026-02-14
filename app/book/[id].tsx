import { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  Image,
  Pressable,
  TextInput,
  Alert,
  Switch,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useLibraryStore } from "@/store/useLibraryStore";
import { useTheme } from "@/utils/theme";
import { GenreBadge } from "@/components/GenreBadge";
import type { Book } from "@/types/book";

export default function BookDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { books, updateBook, deleteBook } = useLibraryStore();
  const { isDark } = useTheme();
  const router = useRouter();

  const book = books.find((b) => b.id === id);

  const [notes, setNotes] = useState(book?.notes || "");
  const [series, setSeries] = useState(book?.series || "");
  const [seriesNumber, setSeriesNumber] = useState(book?.seriesNumber || "");
  const [isRead, setIsRead] = useState(book?.isRead || false);

  useEffect(() => {
    if (book) {
      setNotes(book.notes);
      setSeries(book.series);
      setSeriesNumber(book.seriesNumber);
      setIsRead(book.isRead);
    }
  }, [book]);

  if (!book) {
    return (
      <View className="flex-1 items-center justify-center bg-gray-50 dark:bg-gray-900">
        <Text className="text-gray-500 dark:text-gray-400">
          Book not found
        </Text>
      </View>
    );
  }

  const handleSave = () => {
    updateBook(book.id, { notes, series, seriesNumber, isRead });
    Alert.alert("Saved", "Book details have been updated.");
  };

  const handleDelete = () => {
    Alert.alert("Delete Book", `Remove "${book.title}" from your library?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          deleteBook(book.id);
          router.back();
        },
      },
    ]);
  };

  return (
    <ScrollView className="flex-1 bg-gray-50 dark:bg-gray-900">
      {/* Cover */}
      <View className="items-center pt-6 pb-4">
        {book.coverBase64 || book.coverUrl ? (
          <Image
            source={{ uri: book.coverBase64 || book.coverUrl }}
            className="w-48 h-72 rounded-xl shadow-lg"
            resizeMode="cover"
          />
        ) : (
          <View className="w-48 h-72 rounded-xl bg-gray-200 dark:bg-gray-700 items-center justify-center">
            <Ionicons
              name="book"
              size={48}
              color={isDark ? "#94a3b8" : "#64748b"}
            />
          </View>
        )}
      </View>

      <View className="px-6 pb-8">
        {/* Title & Author */}
        <Text className="text-2xl font-bold text-gray-900 dark:text-white text-center">
          {book.title}
        </Text>
        <Text className="text-gray-500 dark:text-gray-400 text-center mt-1 text-lg">
          {book.authors.join(", ") || "Unknown Author"}
        </Text>

        {/* Genres */}
        {book.genres.length > 0 && (
          <View className="flex-row flex-wrap justify-center gap-2 mt-3">
            {book.genres.map((g) => (
              <GenreBadge key={g} genre={g} />
            ))}
          </View>
        )}

        {/* Info Cards */}
        <View className="bg-white dark:bg-gray-800 rounded-xl p-4 mt-6 shadow-sm">
          {book.isbn && (
            <InfoRow label="ISBN" value={book.isbn} isDark={isDark} />
          )}
          {book.publisher && (
            <InfoRow label="Publisher" value={book.publisher} isDark={isDark} />
          )}
          {book.pageCount && (
            <InfoRow
              label="Pages"
              value={book.pageCount.toString()}
              isDark={isDark}
            />
          )}
          {book.averageRating && (
            <InfoRow
              label="Rating"
              value={`${book.averageRating}/5 (${book.ratingsCount || 0} ratings)`}
              isDark={isDark}
            />
          )}
          <InfoRow
            label="Added"
            value={new Date(book.addedAt).toLocaleDateString()}
            isDark={isDark}
          />
          <InfoRow
            label="Source"
            value={book.source}
            isDark={isDark}
            isLast
          />
        </View>

        {/* Description */}
        {book.description ? (
          <View className="bg-white dark:bg-gray-800 rounded-xl p-4 mt-4 shadow-sm">
            <Text className="text-gray-900 dark:text-white font-bold mb-2">
              Description
            </Text>
            <Text className="text-gray-600 dark:text-gray-300 leading-6">
              {book.description}
            </Text>
          </View>
        ) : null}

        {/* Editable fields */}
        <View className="bg-white dark:bg-gray-800 rounded-xl p-4 mt-4 shadow-sm">
          <Text className="text-gray-900 dark:text-white font-bold mb-3">
            Your Details
          </Text>

          {/* Read toggle */}
          <View className="flex-row items-center justify-between mb-4">
            <Text className="text-gray-700 dark:text-gray-300">
              Mark as Read
            </Text>
            <Switch
              value={isRead}
              onValueChange={setIsRead}
              trackColor={{ true: "#22c55e" }}
            />
          </View>

          {/* Series */}
          <Text className="text-gray-500 dark:text-gray-400 text-sm mb-1">
            Series
          </Text>
          <TextInput
            value={series}
            onChangeText={setSeries}
            placeholder="Series name"
            placeholderTextColor={isDark ? "#64748b" : "#94a3b8"}
            className="bg-gray-100 dark:bg-gray-700 rounded-lg px-3 py-2 text-gray-900 dark:text-white mb-3"
          />

          <Text className="text-gray-500 dark:text-gray-400 text-sm mb-1">
            Book # in Series
          </Text>
          <TextInput
            value={seriesNumber}
            onChangeText={setSeriesNumber}
            placeholder="e.g. 1"
            placeholderTextColor={isDark ? "#64748b" : "#94a3b8"}
            keyboardType="numeric"
            className="bg-gray-100 dark:bg-gray-700 rounded-lg px-3 py-2 text-gray-900 dark:text-white mb-3"
          />

          {/* Notes */}
          <Text className="text-gray-500 dark:text-gray-400 text-sm mb-1">
            Notes
          </Text>
          <TextInput
            value={notes}
            onChangeText={setNotes}
            placeholder="Your thoughts about this book..."
            placeholderTextColor={isDark ? "#64748b" : "#94a3b8"}
            multiline
            numberOfLines={4}
            className="bg-gray-100 dark:bg-gray-700 rounded-lg px-3 py-2 text-gray-900 dark:text-white min-h-[100px]"
            textAlignVertical="top"
          />

          <Pressable
            onPress={handleSave}
            className="bg-blue-500 active:bg-blue-600 rounded-xl py-3 mt-4 items-center"
          >
            <Text className="text-white font-bold">Save Changes</Text>
          </Pressable>
        </View>

        {/* Delete */}
        <Pressable
          onPress={handleDelete}
          className="bg-red-50 dark:bg-red-900/30 rounded-xl py-3 mt-4 items-center flex-row justify-center"
        >
          <Ionicons name="trash" size={18} color="#ef4444" />
          <Text className="text-red-500 font-bold ml-2">Delete Book</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

function InfoRow({
  label,
  value,
  isDark,
  isLast = false,
}: {
  label: string;
  value: string;
  isDark: boolean;
  isLast?: boolean;
}) {
  return (
    <View
      className={`flex-row justify-between py-2 ${
        !isLast ? "border-b border-gray-100 dark:border-gray-700" : ""
      }`}
    >
      <Text className="text-gray-500 dark:text-gray-400">{label}</Text>
      <Text className="text-gray-900 dark:text-white font-medium flex-1 text-right ml-4" numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}
