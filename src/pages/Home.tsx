import { useNavigate } from "react-router-dom";
import { Camera, BookOpen, CheckCircle2, Tags } from "lucide-react";
import { useLibraryStore } from "@/store/useLibraryStore";

function StatCard({
  label,
  value,
  colorClass,
}: {
  label: string;
  value: number | string;
  colorClass: string;
}) {
  return (
    <div className="flex-1 bg-white dark:bg-gray-900 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-800">
      <p className={`text-2xl font-bold ${colorClass}`}>{value}</p>
      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{label}</p>
    </div>
  );
}

export default function Home() {
  const navigate = useNavigate();
  const { books } = useLibraryStore();

  const totalBooks = books.length;
  const readBooks = books.filter((b) => b.isRead).length;
  const genres = new Set(books.flatMap((b) => b.genres));
  const recentBooks = [...books]
    .sort((a, b) => b.addedAt.localeCompare(a.addedAt))
    .slice(0, 8);

  return (
    <div className="max-w-2xl mx-auto">
      {/* Hero */}
      <div className="text-center py-10 md:py-14">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-500 rounded-2xl mb-5 shadow-lg">
          <BookOpen size={32} className="text-white" />
        </div>
        <h1 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-2">
          My Library
        </h1>
        <p className="text-gray-500 dark:text-gray-400 mb-8">
          Your personal book collection, always with you.
        </p>

        <button
          onClick={() => navigate("/scan")}
          className="inline-flex items-center gap-3 bg-blue-500 hover:bg-blue-600 active:bg-blue-700 text-white px-8 py-4 rounded-2xl text-lg font-bold shadow-lg shadow-blue-500/30 transition-all hover:scale-105 active:scale-95"
        >
          <Camera size={24} />
          Scan a Book
        </button>
      </div>

      {/* Stats */}
      {totalBooks > 0 && (
        <div className="flex gap-3 mb-8">
          <StatCard label="Books" value={totalBooks} colorClass="text-blue-500" />
          <StatCard label="Read" value={readBooks} colorClass="text-green-500" />
          <StatCard label="Genres" value={genres.size} colorClass="text-purple-500" />
        </div>
      )}

      {/* Recent books */}
      {recentBooks.length > 0 ? (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-gray-900 dark:text-white text-lg">Recently Added</h2>
            <button
              onClick={() => navigate("/library")}
              className="text-sm text-blue-500 font-medium"
            >
              See all →
            </button>
          </div>

          <div className="flex items-start gap-3 overflow-x-auto pb-4 scrollbar-hide -mx-1 px-1">
            {recentBooks.map((book) => {
              const cover = book.coverBase64 || book.coverUrl;
              return (
                <button
                  key={book.id}
                  onClick={() => navigate(`/book/${book.id}`)}
                  className="shrink-0 w-28 text-left group"
                >
                  <div className="w-28 h-40 rounded-xl overflow-hidden bg-gray-100 dark:bg-gray-800 mb-2 shadow-sm group-hover:shadow-md transition-shadow relative">
                    {cover ? (
                      <img src={cover} alt={book.title} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <BookOpen size={24} className="text-gray-300 dark:text-gray-600" />
                      </div>
                    )}
                    {book.isRead && (
                      <div className="absolute top-1.5 right-1.5">
                        <CheckCircle2
                          size={16}
                          className="text-green-500 drop-shadow"
                          fill="white"
                        />
                      </div>
                    )}
                  </div>
                  <p className="text-xs font-semibold text-gray-900 dark:text-white line-clamp-2 leading-tight">
                    {book.title}
                  </p>
                  <p className="text-[11px] text-gray-400 dark:text-gray-500 truncate mt-0.5">
                    {book.authors[0] || ""}
                  </p>
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        /* Empty hero */
        <div className="bg-white dark:bg-gray-900 rounded-3xl border border-dashed border-gray-300 dark:border-gray-700 p-10 text-center">
          <Tags size={36} className="text-gray-300 dark:text-gray-600 mx-auto mb-4" />
          <p className="text-gray-500 dark:text-gray-400 text-sm">
            Your library is empty — scan a book to get started!
          </p>
        </div>
      )}
    </div>
  );
}
