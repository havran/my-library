import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { BookOpen, CheckCircle2, Search } from "lucide-react";
import { GenreBadge } from "./GenreBadge";
import { CoverPicker } from "./CoverPicker";
import { useLibraryStore } from "@/store/useLibraryStore";
import { searchAllCovers, downloadCover } from "@/services/coverSearch";
import type { Book } from "@/types/book";

interface Props {
  book: Book;
}

export function BookCard({ book }: Props) {
  const navigate = useNavigate();
  const { updateBook } = useLibraryStore();
  const [searching, setSearching] = useState(false);
  const [covers, setCovers] = useState<string[]>([]);
  const cover = book.coverBase64 || book.coverUrl;

  const handleSearchCover = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setSearching(true);
    const found = await searchAllCovers(book.isbn ?? "", book.title);
    setSearching(false);
    if (found.length > 0) {
      setCovers(found);
    }
  };

  const handlePickCover = async (url: string) => {
    setCovers([]);
    const base64 = await downloadCover(url);
    await updateBook(book.id, { coverBase64: base64 || "", coverUrl: url });
  };

  return (
    <>
      <div
        onClick={() => navigate(`/book/${book.id}`)}
        className="group w-full cursor-pointer bg-white dark:bg-gray-900 rounded-2xl overflow-hidden shadow-sm hover:shadow-md active:scale-95 transition-all duration-150 border border-gray-100 dark:border-gray-800"
      >
        {/* Cover */}
        <div className="relative w-full aspect-[2/3] bg-gray-100 dark:bg-gray-800">
          {cover ? (
            <img
              src={cover}
              alt={book.title}
              className="w-full h-full object-cover"
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <BookOpen size={32} className="text-gray-300 dark:text-gray-600" />
            </div>
          )}
          {/* Read badge */}
          {book.isRead && (
            <div className="absolute top-2 right-2">
              <CheckCircle2 size={20} className="text-green-500 drop-shadow" fill="white" />
            </div>
          )}
          {/* Cover search button */}
          {!cover && (
            <button
              onClick={handleSearchCover}
              disabled={searching}
              className="absolute bottom-2 right-2 p-1.5 rounded-lg bg-white/80 dark:bg-gray-900/80 text-gray-500 hover:text-blue-500 transition-colors disabled:opacity-50"
            >
              {searching
                ? <span className="block w-3 h-3 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                : <Search size={12} />
              }
            </button>
          )}
          {/* Series badge */}
          {book.series && (
            <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/70 to-transparent px-2 py-1.5">
              <p className="text-white text-[10px] font-medium truncate">
                {book.series}{book.seriesNumber ? ` #${book.seriesNumber}` : ""}
              </p>
            </div>
          )}
        </div>

        {/* Info */}
        <div className="p-2.5">
          <p className="text-xs font-semibold text-gray-900 dark:text-white line-clamp-2 leading-tight mb-1">
            {book.title}
          </p>
          <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate mb-1.5">
            {book.authors[0] || "Unknown Author"}
          </p>
          {book.genres.length > 0 && (
            <div className="flex flex-wrap gap-1">
              <GenreBadge genre={book.genres[0]} />
            </div>
          )}
        </div>
      </div>

      {covers.length > 0 && (
        <CoverPicker
          covers={covers}
          onSelect={handlePickCover}
          onClose={() => setCovers([])}
        />
      )}
    </>
  );
}
