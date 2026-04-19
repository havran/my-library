import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Trash2, BookOpen, Star, CheckCircle2, Circle, Camera, Image as ImageIcon, Search, RefreshCw } from "lucide-react";
import { useLibraryStore } from "@/store/useLibraryStore";
import { GenreBadge } from "@/components/GenreBadge";
import { CoverPicker } from "@/components/CoverPicker";
import { searchAllCovers, downloadCover } from "@/services/coverSearch";
import { fetchByISBN } from "@/services/bookApi";

const inputCls =
  "w-full px-3 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-shadow";

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-start py-2.5 border-b border-gray-100 dark:border-gray-800 last:border-0">
      <span className="text-sm text-gray-500 dark:text-gray-400 shrink-0 mr-4">{label}</span>
      <span className="text-sm text-gray-900 dark:text-white font-medium text-right">{value}</span>
    </div>
  );
}

export default function BookDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { books, updateBook, deleteBook } = useLibraryStore();

  const book = books.find((b) => b.id === id);

  const [notes, setNotes] = useState("");
  const [series, setSeries] = useState("");
  const [seriesNumber, setSeriesNumber] = useState("");
  const [isRead, setIsRead] = useState(false);
  const [customCover, setCustomCover] = useState("");
  const [searchingCover, setSearchingCover] = useState(false);
  const [coverNotFound, setCoverNotFound] = useState(false);
  const [coverOptions, setCoverOptions] = useState<string[]>([]);
  const [saved, setSaved] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [rescanning, setRescanning] = useState(false);
  const [rescanResult, setRescanResult] = useState<"updated" | "no-change" | "error" | null>(null);

  useEffect(() => {
    if (book) {
      setNotes(book.notes);
      setSeries(book.series);
      setSeriesNumber(book.seriesNumber);
      setIsRead(book.isRead);
      setCustomCover(book.coverBase64 || "");
    }
  }, [book]);

  if (!book) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <BookOpen size={48} className="text-gray-300 dark:text-gray-600" />
        <p className="text-gray-500 dark:text-gray-400">Book not found.</p>
        <button onClick={() => navigate(-1)} className="text-blue-500 font-medium">Go back</button>
      </div>
    );
  }

  const cover = customCover || book.coverUrl;

  const handleSave = async () => {
    await updateBook(book.id, {
      notes,
      series,
      seriesNumber,
      isRead,
      coverBase64: customCover,
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleDelete = async () => {
    await deleteBook(book.id);
    navigate("/library");
  };

  const handleRescan = async () => {
    if (!book.isbn) return;
    setRescanning(true);
    setRescanResult(null);
    try {
      const [fresh, covers] = await Promise.all([
        fetchByISBN(book.isbn),
        searchAllCovers(book.isbn, book.title),
      ]);

      if (!fresh && covers.length === 0) { setRescanResult("error"); return; }

      const changes: Record<string, any> = {};
      if (fresh) {
        if (fresh.authors.length && fresh.authors.join() !== book.authors.join()) changes.authors = fresh.authors;
        if (fresh.genres.length && fresh.genres.join() !== book.genres.join()) changes.genres = fresh.genres;
        if (fresh.description && fresh.description !== book.description) changes.description = fresh.description;
        if (fresh.publisher && fresh.publisher !== book.publisher) changes.publisher = fresh.publisher;
        if (fresh.pageCount && fresh.pageCount !== book.pageCount) changes.pageCount = fresh.pageCount;
        if (fresh.averageRating != null) changes.averageRating = fresh.averageRating;
        if (fresh.ratingsCount != null) changes.ratingsCount = fresh.ratingsCount;
        if (fresh.series && !book.series) { changes.series = fresh.series; setSeries(fresh.series); }
        if (fresh.seriesNumber && !book.seriesNumber) { changes.seriesNumber = fresh.seriesNumber; setSeriesNumber(fresh.seriesNumber); }
      }

      if (Object.keys(changes).length > 0) {
        await updateBook(book.id, changes);
        setRescanResult("updated");
      } else {
        setRescanResult("no-change");
      }

      // Always offer cover picker so user can pick or replace the cover
      if (covers.length > 0) setCoverOptions(covers);
    } catch {
      setRescanResult("error");
    } finally {
      setRescanning(false);
      setTimeout(() => setRescanResult(null), 3000);
    }
  };

  const findCoverOnline = async () => {
    setSearchingCover(true);
    setCoverNotFound(false);
    const found = await searchAllCovers(book.isbn ?? "", book.title);
    setSearchingCover(false);
    if (found.length === 0) {
      setCoverNotFound(true);
      setTimeout(() => setCoverNotFound(false), 3000);
    } else {
      setCoverOptions(found);
    }
  };

  const handlePickCover = async (url: string) => {
    setCoverOptions([]);
    const base64 = await downloadCover(url);
    setCustomCover(base64 || url);
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
      reader.onloadend = () => setCustomCover(reader.result as string);
      reader.readAsDataURL(file);
    };
    input.click();
  };

  return (
    <div className="max-w-2xl mx-auto">
      {/* Back */}
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 mb-6 -ml-1 transition-colors"
      >
        <ArrowLeft size={18} />
        <span className="text-sm font-medium">Back</span>
      </button>

      {/* Cover + Title */}
      <div className="flex flex-col sm:flex-row gap-6 mb-8">
        <div className="shrink-0 flex flex-col items-center gap-2">
          <div className="w-36 h-52 rounded-2xl overflow-hidden bg-gray-100 dark:bg-gray-800 shadow-lg">
            {cover ? (
              <img src={cover} alt={book.title} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <BookOpen size={40} className="text-gray-300 dark:text-gray-600" />
              </div>
            )}
          </div>
          {/* Replace cover buttons */}
          <div className="flex gap-2">
            <button
              onClick={() => pickCover("environment")}
              title="Camera"
              className="p-2 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:text-blue-500 transition-colors"
            >
              <Camera size={16} />
            </button>
            <button
              onClick={() => pickCover()}
              title="Gallery"
              className="p-2 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:text-blue-500 transition-colors"
            >
              <ImageIcon size={16} />
            </button>
            <button
              onClick={findCoverOnline}
              disabled={searchingCover}
              title={coverNotFound ? "Cover not found" : "Search cover online"}
              className={`p-2 rounded-xl transition-colors text-sm font-medium ${
                coverNotFound
                  ? "bg-red-50 dark:bg-red-900/20 text-red-500"
                  : "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:text-blue-500"
              } disabled:opacity-50`}
            >
              {searchingCover
                ? <span className="block w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                : <Search size={16} />
              }
            </button>
            {book.isbn && (
              <button
                onClick={handleRescan}
                disabled={rescanning}
                title={
                  rescanResult === "updated" ? "Metadata updated!" :
                  rescanResult === "no-change" ? "Already up to date" :
                  rescanResult === "error" ? "Rescan failed" :
                  "Rescan metadata & cover"
                }
                className={`p-2 rounded-xl transition-colors text-sm font-medium disabled:opacity-50 ${
                  rescanResult === "updated" ? "bg-green-50 dark:bg-green-900/20 text-green-500" :
                  rescanResult === "no-change" ? "bg-gray-100 dark:bg-gray-800 text-gray-400" :
                  rescanResult === "error" ? "bg-red-50 dark:bg-red-900/20 text-red-500" :
                  "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:text-blue-500"
                }`}
              >
                <RefreshCw size={16} className={rescanning ? "animate-spin" : ""} />
              </button>
            )}
            {customCover && (
              <button
                onClick={() => setCustomCover("")}
                title="Reset cover"
                className="p-2 rounded-xl bg-red-50 dark:bg-red-900/20 text-red-500 hover:bg-red-100 transition-colors text-xs font-medium"
              >
                Reset
              </button>
            )}
          </div>
        </div>

        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white leading-tight mb-1">
            {book.title}
          </h1>
          <p className="text-gray-500 dark:text-gray-400 text-base mb-1">
            {book.authors.join(", ") || "Unknown Author"}
          </p>

          {(series || seriesNumber) && (
            <p className="text-sm font-semibold text-blue-500 dark:text-blue-400 mb-3">
              {series}{seriesNumber ? ` #${seriesNumber}` : ""}
            </p>
          )}

          {book.genres.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-3">
              {book.genres.map((g) => <GenreBadge key={g} genre={g} size="md" />)}
            </div>
          )}

          {book.averageRating && (
            <div className="flex items-center gap-1.5 text-amber-500 mb-3">
              <Star size={16} fill="currentColor" />
              <span className="text-sm font-semibold">{book.averageRating}</span>
              {book.ratingsCount && (
                <span className="text-xs text-gray-400">({book.ratingsCount.toLocaleString()} ratings)</span>
              )}
            </div>
          )}

          {/* Quick read toggle */}
          <button
            onClick={() => setIsRead(!isRead)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
              isRead
                ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400"
                : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300"
            }`}
          >
            {isRead ? <CheckCircle2 size={16} /> : <Circle size={16} />}
            {isRead ? "Marked as Read" : "Mark as Read"}
          </button>
        </div>
      </div>

      {/* Info card */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-800 mb-4">
        {book.isbn && <InfoRow label="ISBN" value={book.isbn} />}
        {book.publisher && <InfoRow label="Publisher" value={book.publisher} />}
        {book.pageCount && <InfoRow label="Pages" value={book.pageCount.toString()} />}
        <InfoRow label="Added" value={new Date(book.addedAt).toLocaleDateString()} />
        <InfoRow label="Source" value={book.source} />
      </div>

      {/* Description */}
      {book.description && (
        <div className="bg-white dark:bg-gray-900 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-800 mb-4">
          <p className="font-semibold text-gray-900 dark:text-white mb-2">Description</p>
          <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">{book.description}</p>
        </div>
      )}

      {/* Editable details */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-800 mb-4">
        <p className="font-semibold text-gray-900 dark:text-white mb-4">Your Details</p>

        <div className="flex gap-3 mb-4">
          <div className="flex-1">
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">Series</label>
            <input
              value={series}
              onChange={(e) => setSeries(e.target.value)}
              placeholder="Series name"
              className={inputCls}
            />
          </div>
          <div className="w-24">
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">Book #</label>
            <input
              type="number"
              value={seriesNumber}
              onChange={(e) => setSeriesNumber(e.target.value)}
              placeholder="1"
              className={inputCls}
            />
          </div>
        </div>

        <div className="mb-4">
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">Notes</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Your thoughts about this book…"
            rows={4}
            className={`${inputCls} resize-none`}
          />
        </div>

        <button
          onClick={handleSave}
          className={`w-full py-3 rounded-2xl font-semibold text-sm transition-all ${
            saved
              ? "bg-green-500 text-white"
              : "bg-blue-500 hover:bg-blue-600 active:bg-blue-700 text-white"
          }`}
        >
          {saved ? "✓ Saved!" : "Save Changes"}
        </button>
      </div>

      {/* Delete */}
      <button
        onClick={() => setConfirmDelete(true)}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl border border-red-200 dark:border-red-900 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 font-semibold text-sm transition-colors mb-8"
      >
        <Trash2 size={16} />
        Remove from Library
      </button>

      {/* Delete confirmation */}
      {confirmDelete && (
        <div
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={(e) => e.target === e.currentTarget && setConfirmDelete(false)}
        >
          <div className="bg-white dark:bg-gray-900 rounded-3xl p-6 max-w-sm w-full shadow-2xl">
            <h3 className="font-bold text-gray-900 dark:text-white text-lg mb-2">Remove book?</h3>
            <p className="text-gray-500 dark:text-gray-400 text-sm mb-6">
              "{book.title}" will be permanently deleted from your library.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmDelete(false)}
                className="flex-1 py-3 rounded-2xl border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="flex-1 py-3 rounded-2xl bg-red-500 hover:bg-red-600 text-white font-semibold"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {coverOptions.length > 0 && (
        <CoverPicker
          covers={coverOptions}
          onSelect={handlePickCover}
          onClose={() => setCoverOptions([])}
        />
      )}
    </div>
  );
}
