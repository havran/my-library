import { useMemo, useState } from "react";
import { Trash2, BookOpen } from "lucide-react";
import { useLibraryStore } from "@/store/useLibraryStore";
import { filterBooks, sortBooks } from "@/utils/helpers";
import { SearchBar } from "@/components/SearchBar";
import { SortPicker } from "@/components/SortPicker";
import { BookCard } from "@/components/BookCard";
import { EmptyState } from "@/components/EmptyState";

export default function Library() {
  const {
    books,
    searchQuery,
    setSearchQuery,
    sortField,
    sortDirection,
    setSortField,
    setSortDirection,
    deleteBook,
  } = useLibraryStore();

  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const displayed = useMemo(
    () => sortBooks(filterBooks(books, searchQuery), sortField, sortDirection),
    [books, searchQuery, sortField, sortDirection]
  );

  if (books.length === 0) return <EmptyState />;

  return (
    <div>
      {/* Toolbar */}
      <div className="mb-5 space-y-2">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">
            Library
            <span className="ml-2 text-sm font-normal text-gray-400 dark:text-gray-500">
              ({books.length})
            </span>
          </h1>
        </div>
        <SearchBar value={searchQuery} onChange={setSearchQuery} />
        <SortPicker
          sortField={sortField}
          sortDirection={sortDirection}
          onSortFieldChange={setSortField}
          onSortDirectionChange={setSortDirection}
        />
      </div>

      {/* Grid */}
      {displayed.length === 0 ? (
        <div className="flex flex-col items-center py-16 text-center text-gray-400 dark:text-gray-500 gap-3">
          <BookOpen size={36} className="opacity-30" />
          <p>No books match your search.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {displayed.map((book) => (
            <div key={book.id} className="relative group">
              <BookCard book={book} />
              {/* Delete button on hover/long-press */}
              <button
                onClick={() => setConfirmDelete(book.id)}
                className="absolute top-2 left-2 p-1.5 rounded-xl bg-red-500 text-white opacity-0 group-hover:opacity-100 transition-opacity shadow"
                aria-label="Delete book"
              >
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Delete confirmation dialog */}
      {confirmDelete && (
        <div
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={(e) => e.target === e.currentTarget && setConfirmDelete(null)}
        >
          <div className="bg-white dark:bg-gray-900 rounded-3xl p-6 max-w-sm w-full shadow-2xl">
            <h3 className="font-bold text-gray-900 dark:text-white text-lg mb-2">
              Remove from library?
            </h3>
            <p className="text-gray-500 dark:text-gray-400 text-sm mb-6">
              "{books.find((b) => b.id === confirmDelete)?.title}" will be permanently deleted.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmDelete(null)}
                className="flex-1 py-3 rounded-2xl border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => { deleteBook(confirmDelete); setConfirmDelete(null); }}
                className="flex-1 py-3 rounded-2xl bg-red-500 hover:bg-red-600 text-white font-semibold flex items-center justify-center gap-2 transition-colors"
              >
                <Trash2 size={16} />
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
