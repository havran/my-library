import { useState, useRef } from "react";
import {
  View,
  Text,
  Pressable,
  Alert,
  TextInput,
  Modal,
  ScrollView,
  Image,
  ActivityIndicator,
  Platform,
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useLibraryStore } from "@/store/useLibraryStore";
import { fetchByISBN, searchByTitle } from "@/services/bookApi";
import { searchByOCR } from "@/services/coverSearch";
import { fetchImageAsBase64 } from "@/services/imageCache";
import { useTheme } from "@/utils/theme";
import { generateId } from "@/utils/helpers";
import { BookPreview } from "@/components/BookPreview";
import { ManualAddForm } from "@/components/ManualAddForm";
import type { Book, BookSearchResult } from "@/types/book";

type ScanMode = "barcode" | "cover" | "manual";

export default function ScanScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [mode, setMode] = useState<ScanMode>("barcode");
  const [torch, setTorch] = useState(false);
  const [scannedData, setScannedData] = useState<BookSearchResult | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [searchResults, setSearchResults] = useState<BookSearchResult[]>([]);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [showManual, setShowManual] = useState(false);
  const [manualISBN, setManualISBN] = useState("");
  const scannedRef = useRef(false);

  const { addBook } = useLibraryStore();
  const { isDark } = useTheme();
  const router = useRouter();

  const handleBarcodeScan = async ({ data }: { data: string }) => {
    if (scannedRef.current || isLoading) return;
    scannedRef.current = true;
    setIsLoading(true);

    const result = await fetchByISBN(data);
    if (result) {
      setScannedData(result);
      setShowPreview(true);
    } else {
      Alert.alert("Not Found", `No book found for ISBN: ${data}`, [
        { text: "OK", onPress: () => (scannedRef.current = false) },
      ]);
    }
    setIsLoading(false);
  };

  const handleManualISBN = async () => {
    if (!manualISBN.trim()) return;
    setIsLoading(true);
    const result = await fetchByISBN(manualISBN.trim());
    if (result) {
      setScannedData(result);
      setShowPreview(true);
    } else {
      Alert.alert("Not Found", `No book found for ISBN: ${manualISBN}`);
    }
    setIsLoading(false);
  };

  const handleCoverSearch = async () => {
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ["images"],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setIsLoading(true);
      const results = await searchByOCR(result.assets[0].uri);
      if (results.length > 0) {
        setSearchResults(results);
        setShowSearchResults(true);
      } else {
        Alert.alert("No Results", "Could not identify the book from the cover. Try manual entry.");
      }
      setIsLoading(false);
    }
  };

  const handleAddBook = async (
    data: BookSearchResult,
    source: Book["source"]
  ) => {
    const coverBase64 = await fetchImageAsBase64(data.coverUrl);
    const book: Book = {
      id: generateId(),
      isbn: data.isbn,
      title: data.title,
      authors: data.authors,
      genres: data.genres,
      description: data.description,
      publisher: data.publisher,
      pageCount: data.pageCount,
      series: "",
      seriesNumber: "",
      coverUrl: data.coverUrl,
      coverBase64,
      averageRating: data.averageRating,
      ratingsCount: data.ratingsCount,
      isRead: false,
      notes: "",
      source,
      addedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await addBook(book);
    setShowPreview(false);
    setShowSearchResults(false);
    scannedRef.current = false;
    Alert.alert("Added!", `"${book.title}" has been added to your library.`);
  };

  if (!permission) {
    return (
      <View className="flex-1 items-center justify-center bg-gray-50 dark:bg-gray-900">
        <ActivityIndicator size="large" color="#3b82f6" />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View className="flex-1 items-center justify-center bg-gray-50 dark:bg-gray-900 px-6">
        <Ionicons
          name="camera-outline"
          size={64}
          color={isDark ? "#94a3b8" : "#64748b"}
        />
        <Text className="text-gray-900 dark:text-white text-lg font-bold mt-4 text-center">
          Camera Permission Required
        </Text>
        <Text className="text-gray-500 dark:text-gray-400 text-center mt-2">
          We need camera access to scan book barcodes.
        </Text>
        <Pressable
          onPress={requestPermission}
          className="bg-blue-500 rounded-xl px-8 py-3 mt-6"
        >
          <Text className="text-white font-bold">Grant Permission</Text>
        </Pressable>
        <Pressable onPress={() => setMode("manual")} className="mt-4">
          <Text className="text-blue-500 font-medium">
            Or add books manually
          </Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-gray-50 dark:bg-gray-900">
      {/* Mode Switcher */}
      <View className="flex-row bg-white dark:bg-gray-800 mx-4 mt-4 rounded-xl overflow-hidden">
        {(["barcode", "cover", "manual"] as ScanMode[]).map((m) => (
          <Pressable
            key={m}
            onPress={() => {
              setMode(m);
              scannedRef.current = false;
            }}
            className={`flex-1 py-3 items-center ${
              mode === m ? "bg-blue-500" : ""
            }`}
          >
            <Text
              className={`font-medium capitalize ${
                mode === m ? "text-white" : "text-gray-600 dark:text-gray-300"
              }`}
            >
              {m === "barcode" ? "Barcode" : m === "cover" ? "Cover" : "Manual"}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Barcode mode */}
      {mode === "barcode" && (
        <View className="flex-1 mt-4 mx-4 rounded-2xl overflow-hidden">
          <CameraView
            style={{ flex: 1 }}
            facing="back"
            enableTorch={torch}
            barcodeScannerSettings={{
              barcodeTypes: ["ean13", "ean8", "upc_a", "upc_e"],
            }}
            onBarcodeScanned={handleBarcodeScan}
          >
            <View className="flex-1 items-center justify-center">
              <View className="w-64 h-36 border-2 border-white rounded-xl opacity-70" />
              <Text className="text-white mt-4 text-center font-medium">
                Point at a book barcode
              </Text>
            </View>
            <View className="absolute bottom-6 right-6">
              <Pressable
                onPress={() => setTorch(!torch)}
                className="bg-black/50 rounded-full p-3"
              >
                <Ionicons
                  name={torch ? "flash" : "flash-off"}
                  size={24}
                  color="white"
                />
              </Pressable>
            </View>
          </CameraView>
          {isLoading && (
            <View className="absolute inset-0 items-center justify-center bg-black/40">
              <ActivityIndicator size="large" color="white" />
              <Text className="text-white mt-2">Looking up book...</Text>
            </View>
          )}
        </View>
      )}

      {/* Cover search mode */}
      {mode === "cover" && (
        <View className="flex-1 items-center justify-center px-6">
          <Ionicons
            name="image"
            size={64}
            color={isDark ? "#60a5fa" : "#3b82f6"}
          />
          <Text className="text-gray-900 dark:text-white text-lg font-bold mt-4">
            Search by Cover
          </Text>
          <Text className="text-gray-500 dark:text-gray-400 text-center mt-2">
            Take a photo of the book cover.{"\n"}We'll try to identify it using
            text recognition.
          </Text>
          <Pressable
            onPress={handleCoverSearch}
            className="bg-blue-500 active:bg-blue-600 rounded-xl px-8 py-4 mt-6 flex-row items-center"
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="white" />
            ) : (
              <>
                <Ionicons name="camera" size={24} color="white" />
                <Text className="text-white font-bold ml-2">
                  Take Photo
                </Text>
              </>
            )}
          </Pressable>
        </View>
      )}

      {/* Manual mode */}
      {mode === "manual" && (
        <ScrollView className="flex-1 px-4 pt-4">
          <View className="bg-white dark:bg-gray-800 rounded-xl p-4 mb-4">
            <Text className="text-gray-900 dark:text-white font-bold text-lg mb-3">
              Enter ISBN
            </Text>
            <View className="flex-row items-center">
              <TextInput
                value={manualISBN}
                onChangeText={setManualISBN}
                placeholder="e.g. 9780743273565"
                placeholderTextColor={isDark ? "#64748b" : "#94a3b8"}
                keyboardType="numeric"
                className="flex-1 bg-gray-100 dark:bg-gray-700 rounded-lg px-4 py-3 text-gray-900 dark:text-white mr-2"
              />
              <Pressable
                onPress={handleManualISBN}
                className="bg-blue-500 rounded-lg px-4 py-3"
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator color="white" size="small" />
                ) : (
                  <Ionicons name="search" size={20} color="white" />
                )}
              </Pressable>
            </View>
          </View>

          <View className="items-center mb-4">
            <Text className="text-gray-400 dark:text-gray-500 font-medium">
              OR
            </Text>
          </View>

          <Pressable
            onPress={() => setShowManual(true)}
            className="bg-white dark:bg-gray-800 rounded-xl p-4 flex-row items-center"
          >
            <Ionicons
              name="create"
              size={24}
              color={isDark ? "#60a5fa" : "#3b82f6"}
            />
            <View className="ml-3">
              <Text className="text-gray-900 dark:text-white font-bold">
                Add Manually
              </Text>
              <Text className="text-gray-500 dark:text-gray-400 text-sm">
                Enter book details by hand
              </Text>
            </View>
          </Pressable>
        </ScrollView>
      )}

      {/* Book Preview Modal */}
      {showPreview && scannedData && (
        <BookPreview
          data={scannedData}
          onAdd={() => handleAddBook(scannedData, mode === "barcode" ? "scan" : "search")}
          onCancel={() => {
            setShowPreview(false);
            scannedRef.current = false;
          }}
        />
      )}

      {/* Search Results Modal */}
      <Modal visible={showSearchResults} animationType="slide" transparent>
        <View className="flex-1 bg-black/50 justify-end">
          <View className="bg-white dark:bg-gray-800 rounded-t-3xl max-h-[80%] p-6">
            <Text className="text-xl font-bold text-gray-900 dark:text-white mb-4">
              Select the correct book
            </Text>
            <ScrollView>
              {searchResults.map((result, i) => (
                <Pressable
                  key={i}
                  onPress={() => handleAddBook(result, "cover")}
                  className="flex-row py-3 border-b border-gray-100 dark:border-gray-700"
                >
                  {result.coverUrl ? (
                    <Image
                      source={{ uri: result.coverUrl }}
                      className="w-12 h-16 rounded"
                      resizeMode="cover"
                    />
                  ) : (
                    <View className="w-12 h-16 rounded bg-gray-200 dark:bg-gray-600 items-center justify-center">
                      <Ionicons name="book" size={16} color="#94a3b8" />
                    </View>
                  )}
                  <View className="ml-3 flex-1">
                    <Text
                      className="text-gray-900 dark:text-white font-medium"
                      numberOfLines={1}
                    >
                      {result.title}
                    </Text>
                    <Text
                      className="text-gray-500 dark:text-gray-400 text-sm"
                      numberOfLines={1}
                    >
                      {result.authors.join(", ")}
                    </Text>
                  </View>
                </Pressable>
              ))}
            </ScrollView>
            <Pressable
              onPress={() => setShowSearchResults(false)}
              className="bg-gray-200 dark:bg-gray-700 rounded-xl py-3 mt-4 items-center"
            >
              <Text className="text-gray-900 dark:text-white font-medium">
                Cancel
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Manual Add Modal */}
      <Modal visible={showManual} animationType="slide">
        <ManualAddForm onClose={() => setShowManual(false)} />
      </Modal>
    </View>
  );
}
