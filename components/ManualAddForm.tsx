import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  Alert,
  ActivityIndicator,
  Image,
  Modal,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/utils/theme";
import { useLibraryStore } from "@/store/useLibraryStore";
import { searchByTitle } from "@/services/bookApi";
import { fetchImageAsBase64 } from "@/services/imageCache";
import { generateId } from "@/utils/helpers";
import type { Book, BookSearchResult } from "@/types/book";

interface Props {
  onClose: () => void;
}

export function ManualAddForm({ onClose }: Props) {
  const { isDark } = useTheme();
  const { addBook } = useLibraryStore();

  const [title, setTitle] = useState("");
  const [authors, setAuthors] = useState("");
  const [genres, setGenres] = useState("");
  const [description, setDescription] = useState("");
  const [publisher, setPublisher] = useState("");
  const [pageCount, setPageCount] = useState("");
  const [series, setSeries] = useState("");
  const [seriesNumber, setSeriesNumber] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<BookSearchResult[]>([]);
  const [showResults, setShowResults] = useState(false);

  const handleSearchByTitle = async () => {
    if (!title.trim()) {
      Alert.alert("Error", "Enter a title to search.");
      return;
    }
    setIsSearching(true);
    const results = await searchByTitle(title.trim());
    if (results.length > 0) {
      setSearchResults(results);
      setShowResults(true);
    } else {
      Alert.alert("No Results", "No books found matching that title.");
    }
    setIsSearching(false);
  };

  const handleFillFromResult = (result: BookSearchResult) => {
    setTitle(result.title);
    setAuthors(result.authors.join(", "));
    setGenres(result.genres.join(", "));
    setDescription(result.description);
    setPublisher(result.publisher);
    setPageCount(result.pageCount?.toString() || "");
    setShowResults(false);
  };

  const handleSave = async () => {
    if (!title.trim()) {
      Alert.alert("Error", "Title is required.");
      return;
    }

    const book: Book = {
      id: generateId(),
      isbn: null,
      title: title.trim(),
      authors: authors
        .split(",")
        .map((a) => a.trim())
        .filter(Boolean),
      genres: genres
        .split(",")
        .map((g) => g.trim())
        .filter(Boolean),
      description: description.trim(),
      publisher: publisher.trim(),
      pageCount: pageCount ? parseInt(pageCount, 10) : null,
      series: series.trim(),
      seriesNumber: seriesNumber.trim(),
      coverUrl: "",
      coverBase64: "",
      averageRating: null,
      ratingsCount: null,
      isRead: false,
      notes: "",
      source: "manual",
      addedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await addBook(book);
    Alert.alert("Added!", `"${book.title}" has been added to your library.`);
    onClose();
  };

  return (
    <View className="flex-1 bg-gray-50 dark:bg-gray-900">
      <View className="flex-row items-center justify-between px-4 pt-12 pb-4 bg-white dark:bg-gray-800">
        <Pressable onPress={onClose}>
          <Ionicons
            name="close"
            size={28}
            color={isDark ? "#f1f5f9" : "#1e293b"}
          />
        </Pressable>
        <Text className="text-lg font-bold text-gray-900 dark:text-white">
          Add Book Manually
        </Text>
        <Pressable onPress={handleSave}>
          <Text className="text-blue-500 font-bold text-lg">Save</Text>
        </Pressable>
      </View>

      <ScrollView className="flex-1 px-4 pt-4">
        <InputField
          label="Title *"
          value={title}
          onChangeText={setTitle}
          placeholder="Book title"
          isDark={isDark}
        />

        <Pressable
          onPress={handleSearchByTitle}
          className="bg-blue-50 dark:bg-blue-900/30 rounded-lg py-2.5 items-center mb-4 flex-row justify-center"
          disabled={isSearching}
        >
          {isSearching ? (
            <ActivityIndicator size="small" color="#3b82f6" />
          ) : (
            <>
              <Ionicons name="search" size={16} color="#3b82f6" />
              <Text className="text-blue-500 font-medium ml-2">
                Search by Title to Auto-fill
              </Text>
            </>
          )}
        </Pressable>

        <InputField
          label="Authors"
          value={authors}
          onChangeText={setAuthors}
          placeholder="Author 1, Author 2"
          isDark={isDark}
        />
        <InputField
          label="Genres"
          value={genres}
          onChangeText={setGenres}
          placeholder="Fiction, Science Fiction"
          isDark={isDark}
        />
        <InputField
          label="Description"
          value={description}
          onChangeText={setDescription}
          placeholder="Brief description"
          isDark={isDark}
          multiline
        />
        <InputField
          label="Publisher"
          value={publisher}
          onChangeText={setPublisher}
          placeholder="Publisher name"
          isDark={isDark}
        />
        <InputField
          label="Page Count"
          value={pageCount}
          onChangeText={setPageCount}
          placeholder="300"
          isDark={isDark}
          keyboardType="numeric"
        />
        <InputField
          label="Series"
          value={series}
          onChangeText={setSeries}
          placeholder="Series name"
          isDark={isDark}
        />
        <InputField
          label="Book # in Series"
          value={seriesNumber}
          onChangeText={setSeriesNumber}
          placeholder="1"
          isDark={isDark}
          keyboardType="numeric"
        />

        <View className="h-8" />
      </ScrollView>

      {/* Search results */}
      <Modal visible={showResults} animationType="slide" transparent>
        <View className="flex-1 bg-black/50 justify-end">
          <View className="bg-white dark:bg-gray-800 rounded-t-3xl max-h-[70%] p-6">
            <Text className="text-xl font-bold text-gray-900 dark:text-white mb-4">
              Select a book to auto-fill
            </Text>
            <ScrollView>
              {searchResults.map((result, i) => (
                <Pressable
                  key={i}
                  onPress={() => handleFillFromResult(result)}
                  className="flex-row py-3 border-b border-gray-100 dark:border-gray-700"
                >
                  {result.coverUrl ? (
                    <Image
                      source={{ uri: result.coverUrl }}
                      className="w-10 h-14 rounded"
                      resizeMode="cover"
                    />
                  ) : (
                    <View className="w-10 h-14 rounded bg-gray-200 dark:bg-gray-600 items-center justify-center">
                      <Ionicons name="book" size={14} color="#94a3b8" />
                    </View>
                  )}
                  <View className="ml-3 flex-1">
                    <Text
                      className="text-gray-900 dark:text-white font-medium"
                      numberOfLines={1}
                    >
                      {result.title}
                    </Text>
                    <Text className="text-gray-500 dark:text-gray-400 text-sm" numberOfLines={1}>
                      {result.authors.join(", ")}
                    </Text>
                  </View>
                </Pressable>
              ))}
            </ScrollView>
            <Pressable
              onPress={() => setShowResults(false)}
              className="bg-gray-200 dark:bg-gray-700 rounded-xl py-3 mt-4 items-center"
            >
              <Text className="text-gray-900 dark:text-white font-medium">
                Cancel
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function InputField({
  label,
  value,
  onChangeText,
  placeholder,
  isDark,
  multiline = false,
  keyboardType,
}: {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
  isDark: boolean;
  multiline?: boolean;
  keyboardType?: "numeric" | "default";
}) {
  return (
    <View className="mb-4">
      <Text className="text-gray-500 dark:text-gray-400 text-sm mb-1">
        {label}
      </Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={isDark ? "#64748b" : "#94a3b8"}
        multiline={multiline}
        keyboardType={keyboardType}
        className={`bg-white dark:bg-gray-800 rounded-lg px-3 py-2.5 text-gray-900 dark:text-white border border-gray-200 dark:border-gray-700 ${
          multiline ? "min-h-[80px]" : ""
        }`}
        textAlignVertical={multiline ? "top" : "center"}
      />
    </View>
  );
}
