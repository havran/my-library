import { X, BookOpen } from "lucide-react";
import type { BookSearchResult } from "@/types/book";

interface Props {
  editions: BookSearchResult[];
  onSelect: (edition: BookSearchResult) => void;
  onClose: () => void;
}

export function EditionPicker({ editions, onSelect, onClose }: Props) {
  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white dark:bg-gray-900 rounded-3xl p-5 w-full max-w-lg max-h-[85vh] flex flex-col shadow-2xl">
        <div className="flex items-center justify-between mb-4 shrink-0">
          <p className="font-semibold text-gray-900 dark:text-white text-sm">
            Vyber vydanie
            <span className="ml-2 text-xs font-normal text-gray-400">({editions.length})</span>
          </p>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <X size={16} />
          </button>
        </div>
        <div className="overflow-y-auto -mx-1 px-1 space-y-2">
          {editions.map((e, i) => (
            <button
              key={`${e.isbn ?? "no-isbn"}-${i}`}
              onClick={() => onSelect(e)}
              className="w-full flex gap-3 p-2 rounded-xl text-left bg-gray-50 dark:bg-gray-800/50 hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:ring-2 hover:ring-blue-500 active:scale-[0.99] transition-all"
            >
              <div className="w-14 h-20 shrink-0 rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                {e.coverUrl ? (
                  <img
                    src={e.coverUrl}
                    alt=""
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <BookOpen size={20} className="text-gray-300 dark:text-gray-600" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                  {e.title}
                </p>
                {e.authors.length > 0 && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                    {e.authors.join(", ")}
                  </p>
                )}
                <div className="mt-1 flex flex-wrap gap-x-2 gap-y-0.5 text-[11px] text-gray-400 dark:text-gray-500">
                  {e.year && <span>{e.year}</span>}
                  {e.publisher && <span className="truncate max-w-full">{e.publisher}</span>}
                  {e.language && <span className="uppercase">{e.language}</span>}
                  {e.isbn && <span className="font-mono">{e.isbn}</span>}
                  {e.pageCount && <span>{e.pageCount} s.</span>}
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
