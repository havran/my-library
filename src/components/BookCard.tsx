import { useNavigate } from "react-router-dom";
import { BookOpen, CheckCircle2 } from "lucide-react";
import { GenreBadge } from "./GenreBadge";
import type { Book } from "@/types/book";

interface Props {
  book: Book;
}

export function BookCard({ book }: Props) {
  const navigate = useNavigate();
  const cover = book.coverBase64 || book.coverUrl;

  return (
    <button
      onClick={() => navigate(`/book/${book.id}`)}
      className="group text-left bg-white dark:bg-gray-900 rounded-2xl overflow-hidden shadow-sm hover:shadow-md active:scale-95 transition-all duration-150 border border-gray-100 dark:border-gray-800"
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
    </button>
  );
}
