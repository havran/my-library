import { useState } from "react";
import { X, Search, Camera, Image, BookOpen, Loader2 } from "lucide-react";
import { useLibraryStore } from "@/store/useLibraryStore";
import { searchByTitle } from "@/services/bookApi";
import { generateId } from "@/utils/helpers";
import type { Book, BookSearchResult } from "@/types/book";

interface Props {
  onClose: () => void;
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-4">
      <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1.5">
        {label}
      </label>
      {children}
    </div>
  );
}

const inputCls =
  "w-full px-3 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-shadow";

export function ManualAddForm({ onClose }: Props) {
  const { addBook } = useLibraryStore();

  const [title, setTitle] = useState("");
  const [authors, setAuthors] = useState("");
  const [genres, setGenres] = useState("");
  const [description, setDescription] = useState("");
  const [publisher, setPublisher] = useState("");
  const [pageCount, setPageCount] = useState("");
  const [series, setSeries] = useState("");
  const [seriesNumber, setSeriesNumber] = useState("");
  const [coverBase64, setCoverBase64] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [searchResults, setSearchResults] = useState<BookSearchResult[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [toast, setToast] = useState("");

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  };

  const pickCover = (capture?: "environment") => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    if (capture) input.capture = capture;
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onloadend = () => setCoverBase64(reader.result as string);
      reader.readAsDataURL(file);
    };
    input.click();
  };

  const handleTitleSearch = async () => {
    if (!title.trim()) { showToast("Enter a title to search."); return; }
    setIsSearching(true);
    const results = await searchByTitle(title.trim());
    setIsSearching(false);
    if (results.length > 0) {
      setSearchResults(results);
      setShowResults(true);
    } else {
      showToast("No books found for that title.");
    }
  };

  const fillFromResult = (r: BookSearchResult) => {
    setTitle(r.title);
    setAuthors(r.authors.join(", "));
    setGenres(r.genres.join(", "));
    setDescription(r.description);
    setPublisher(r.publisher);
    setPageCount(r.pageCount?.toString() || "");
    if (r.coverUrl && !coverBase64) {
      // Fetch and cache cover
      fetch(r.coverUrl)
        .then((res) => res.blob())
        .then((blob) => {
          const fr = new FileReader();
          fr.onloadend = () => setCoverBase64(fr.result as string);
          fr.readAsDataURL(blob);
        })
        .catch(() => {});
    }
    setShowResults(false);
  };

  const handleSave = async () => {
    if (!title.trim()) { showToast("Title is required."); return; }
    setIsSaving(true);
    const book: Book = {
      id: generateId(),
      isbn: null,
      title: title.trim(),
      authors: authors.split(",").map((a) => a.trim()).filter(Boolean),
      genres: genres.split(",").map((g) => g.trim()).filter(Boolean),
      description: description.trim(),
      publisher: publisher.trim(),
      pageCount: pageCount ? parseInt(pageCount, 10) : null,
      series: series.trim(),
      seriesNumber: seriesNumber.trim(),
      coverUrl: "",
      coverBase64,
      averageRating: null,
      ratingsCount: null,
      isRead: false,
      notes: "",
      source: "manual",
      addedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await addBook(book);
    setIsSaving(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-gray-50 dark:bg-gray-950 flex flex-col animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 sticky top-0 z-10">
        <button
          onClick={onClose}
          className="p-2 -ml-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800"
        >
          <X size={20} className="text-gray-600 dark:text-gray-300" />
        </button>
        <h2 className="font-bold text-gray-900 dark:text-white">Add Book Manually</h2>
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="text-blue-500 font-semibold text-sm disabled:opacity-50"
        >
          {isSaving ? "Saving…" : "Save"}
        </button>
      </div>

      {/* Toast */}
      {toast && (
        <div className="mx-4 mt-3 px-4 py-2.5 bg-gray-800 dark:bg-gray-700 text-white text-sm rounded-xl text-center">
          {toast}
        </div>
      )}

      {/* Form */}
      <div className="flex-1 overflow-y-auto px-4 py-5">
        <Field label="Title *">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Book title"
            className={inputCls}
          />
        </Field>

        {/* Search-by-title button */}
        <button
          onClick={handleTitleSearch}
          disabled={isSearching}
          className="w-full mb-5 flex items-center justify-center gap-2 py-2.5 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-xl text-sm font-medium hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
        >
          {isSearching ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
          Search by Title to Auto-fill
        </button>

        <Field label="Authors">
          <input
            value={authors}
            onChange={(e) => setAuthors(e.target.value)}
            placeholder="Author 1, Author 2"
            className={inputCls}
          />
        </Field>
        <Field label="Genres">
          <input
            value={genres}
            onChange={(e) => setGenres(e.target.value)}
            placeholder="Fiction, Science Fiction"
            className={inputCls}
          />
        </Field>
        <Field label="Description">
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Brief description"
            rows={3}
            className={`${inputCls} resize-none`}
          />
        </Field>
        <div className="flex gap-3">
          <div className="flex-1">
            <Field label="Publisher">
              <input
                value={publisher}
                onChange={(e) => setPublisher(e.target.value)}
                placeholder="Publisher"
                className={inputCls}
              />
            </Field>
          </div>
          <div className="w-28">
            <Field label="Pages">
              <input
                type="number"
                value={pageCount}
                onChange={(e) => setPageCount(e.target.value)}
                placeholder="0"
                className={inputCls}
              />
            </Field>
          </div>
        </div>
        <div className="flex gap-3">
          <div className="flex-1">
            <Field label="Series">
              <input
                value={series}
                onChange={(e) => setSeries(e.target.value)}
                placeholder="Series name"
                className={inputCls}
              />
            </Field>
          </div>
          <div className="w-24">
            <Field label="Book #">
              <input
                type="number"
                value={seriesNumber}
                onChange={(e) => setSeriesNumber(e.target.value)}
                placeholder="1"
                className={inputCls}
              />
            </Field>
          </div>
        </div>

        {/* Cover image */}
        <Field label="Cover Image">
          {coverBase64 ? (
            <div className="flex items-start gap-4">
              <img
                src={coverBase64}
                alt="Cover"
                className="w-24 h-36 object-cover rounded-xl shadow border border-gray-200 dark:border-gray-700"
              />
              <button
                onClick={() => setCoverBase64("")}
                className="text-sm text-red-500 font-medium mt-2"
              >
                Remove
              </button>
            </div>
          ) : (
            <div className="flex gap-3">
              <button
                onClick={() => pickCover("environment")}
                className="flex-1 flex items-center justify-center gap-2 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                <Camera size={18} className="text-blue-500" />
                Camera
              </button>
              <button
                onClick={() => pickCover()}
                className="flex-1 flex items-center justify-center gap-2 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                <Image size={18} className="text-blue-500" />
                Gallery
              </button>
            </div>
          )}
        </Field>

        <div className="h-6" />
      </div>

      {/* Search results sheet */}
      {showResults && (
        <div
          className="fixed inset-0 z-60 bg-black/50 backdrop-blur-sm flex items-end"
          onClick={(e) => e.target === e.currentTarget && setShowResults(false)}
        >
          <div className="w-full bg-white dark:bg-gray-900 rounded-t-3xl max-h-[70vh] flex flex-col animate-slide-up">
            <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-gray-800">
              <span className="font-semibold text-gray-900 dark:text-white">Select a book</span>
              <button onClick={() => setShowResults(false)}>
                <X size={20} className="text-gray-400" />
              </button>
            </div>
            <div className="overflow-y-auto flex-1 p-2">
              {searchResults.map((r, i) => (
                <button
                  key={i}
                  onClick={() => fillFromResult(r)}
                  className="w-full flex items-start gap-3 p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-left"
                >
                  <div className="w-10 h-14 shrink-0 rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-800">
                    {r.coverUrl ? (
                      <img src={r.coverUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <BookOpen size={14} className="text-gray-400" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 dark:text-white text-sm truncate">{r.title}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{r.authors.join(", ")}</p>
                    {r.publisher && (
                      <p className="text-xs text-gray-400 dark:text-gray-500 truncate">{r.publisher}</p>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
