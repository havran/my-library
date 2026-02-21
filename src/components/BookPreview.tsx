import { BookOpen, X, Plus } from "lucide-react";
import { GenreBadge } from "./GenreBadge";
import type { BookSearchResult } from "@/types/book";

interface Props {
  data: BookSearchResult;
  onAdd: () => void;
  onCancel: () => void;
  isAdding?: boolean;
}

export function BookPreview({ data, onAdd, onCancel, isAdding }: Props) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in"
      onClick={(e) => e.target === e.currentTarget && onCancel()}
    >
      <div className="bg-white dark:bg-gray-900 rounded-3xl w-full max-w-sm shadow-2xl animate-slide-up overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-gray-800">
          <span className="font-semibold text-gray-900 dark:text-white">Book Found</span>
          <button
            onClick={onCancel}
            className="p-1.5 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <X size={18} className="text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 flex gap-4">
          {/* Cover */}
          <div className="shrink-0 w-24 h-36 rounded-xl overflow-hidden bg-gray-100 dark:bg-gray-800 shadow">
            {data.coverUrl ? (
              <img src={data.coverUrl} alt={data.title} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <BookOpen size={24} className="text-gray-400" />
              </div>
            )}
          </div>

          {/* Details */}
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-gray-900 dark:text-white text-base leading-tight line-clamp-3 mb-1">
              {data.title}
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-2 line-clamp-2">
              {data.authors.join(", ") || "Unknown Author"}
            </p>
            {data.publisher && (
              <p className="text-xs text-gray-400 dark:text-gray-500 mb-2">{data.publisher}</p>
            )}
            <div className="flex flex-wrap gap-1">
              {data.genres.slice(0, 3).map((g) => (
                <GenreBadge key={g} genre={g} />
              ))}
            </div>
            {data.pageCount && (
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">{data.pageCount} pages</p>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 p-4 pt-0">
          <button
            onClick={onCancel}
            className="flex-1 py-3 rounded-2xl border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onAdd}
            disabled={isAdding}
            className="flex-1 py-3 rounded-2xl bg-blue-500 hover:bg-blue-600 active:bg-blue-700 disabled:opacity-60 text-white font-semibold flex items-center justify-center gap-2 transition-colors"
          >
            {isAdding ? (
              <span className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Plus size={18} />
            )}
            {isAdding ? "Adding…" : "Add to Library"}
          </button>
        </div>
      </div>
    </div>
  );
}
