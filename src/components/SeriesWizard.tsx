import { useState, useEffect, useRef } from "react";
import { BookOpen, X, Loader2, ChevronRight, CheckCircle2 } from "lucide-react";
import { useLibraryStore } from "@/store/useLibraryStore";
import { fetchImageAsBase64 } from "@/services/imageCache";
import { apiFetch } from "@/services/apiFetch";
import { generateId } from "@/utils/helpers";
import type { Book } from "@/types/book";

interface Edition {
  coverUrl: string;
  isbn: string | null;
  publisher: string;
  year: string;
  language: string;
}

interface LegieData {
  title?: string;
  authors?: string[];
  coverUrl?: string;
  genres?: string[];
  averageRating?: number | null;
  ratingsCount?: number | null;
  series?: string;
  seriesNumber?: string;
  description?: string;
  isbn?: string | null;
  pageCount?: number | null;
  publisher?: string;
  editions?: Edition[];
  coverUrls?: string[];
}

interface BookRow {
  slug: string;
  title: string;
  order: number;
  loading: boolean;
  data: LegieData | null;
  selected: boolean;
  alreadyInLibrary: boolean;
  selectedEditionIdx: number;
}

interface Props {
  seriesTitle: string;
  serieSlug: string;
  addedBookTitle: string;
  onDone: () => void;
}

export function SeriesWizard({ seriesTitle, serieSlug, addedBookTitle, onDone }: Props) {
  const { addBook, books } = useLibraryStore();
  const [loadingList, setLoadingList] = useState(true);
  const [rows, setRows] = useState<BookRow[]>([]);
  const [expandedSlug, setExpandedSlug] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [done, setDone] = useState(false);
  const [addedCount, setAddedCount] = useState(0);
  // Track fetch abort controllers to cancel on unmount
  const abortRefs = useRef<AbortController[]>([]);

  useEffect(() => {
    apiFetch(`/api/legie/serie?slug=${encodeURIComponent(serieSlug)}`)
      .then((r) => r.json())
      .then((d) => {
        const allBooks: { slug: string; title: string; order: number }[] = d.books ?? [];
        const existingTitles = new Set(books.map((b) => b.title.toLowerCase()));
        const initial: BookRow[] = allBooks
          .filter((b) => b.title.toLowerCase() !== addedBookTitle.toLowerCase())
          .map((b) => ({
            slug: b.slug,
            title: b.title,
            order: b.order,
            loading: true,
            data: null,
            selected: !existingTitles.has(b.title.toLowerCase()),
            alreadyInLibrary: existingTitles.has(b.title.toLowerCase()),
            selectedEditionIdx: 0,
          }));
        setRows(initial);
        setLoadingList(false);

        // Fetch each book's details; server rate-limits to 1 req/s per host automatically
        initial.forEach((row, idx) => {
          const ctrl = new AbortController();
          abortRefs.current.push(ctrl);
          apiFetch(`/api/legie?slug=${encodeURIComponent(row.slug)}`, { signal: ctrl.signal })
            .then((r) => r.json())
            .then((data: LegieData) => {
              setRows((prev) =>
                prev.map((r, i) => (i === idx ? { ...r, loading: false, data } : r)),
              );
            })
            .catch(() => {
              setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, loading: false } : r)));
            });
        });
      })
      .catch(() => setLoadingList(false));

    return () => abortRefs.current.forEach((c) => c.abort());
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleRow = (idx: number) =>
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, selected: !r.selected } : r)));

  const setEdition = (idx: number, edIdx: number) =>
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, selectedEditionIdx: edIdx } : r)));

  const handleAdd = async () => {
    setAdding(true);
    const toAdd = rows.filter((r) => r.selected && !r.alreadyInLibrary);
    let count = 0;
    for (const row of toAdd) {
      const legie = row.data ?? {};
      const editions: Edition[] = legie.editions ?? [];
      const ed = editions[row.selectedEditionIdx] ?? null;
      const coverUrl = ed?.coverUrl || legie.coverUrl || "";
      const coverBase64 = coverUrl ? await fetchImageAsBase64(coverUrl) : "";
      const isbn = ed?.isbn ?? legie.isbn ?? null;

      const newBook: Book = {
        id: generateId(),
        isbn,
        title: legie.title || row.title,
        authors: legie.authors ?? [],
        genres: legie.genres ?? [],
        description: legie.description ?? "",
        publisher: ed?.publisher || (legie.publisher ?? ""),
        pageCount: legie.pageCount ?? null,
        series: seriesTitle,
        seriesNumber: String(row.order),
        coverUrl,
        coverBase64,
        averageRating: legie.averageRating ?? null,
        ratingsCount: legie.ratingsCount ?? null,
        isRead: false,
        notes: "",
        source: "search",
        addedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await addBook(newBook);
      count++;
    }
    setAddedCount(count);
    setAdding(false);
    setDone(true);
  };

  const selectedCount = rows.filter((r) => r.selected && !r.alreadyInLibrary).length;
  const loadingCount = rows.filter((r) => r.loading).length;

  // ── Done screen ──────────────────────────────────────────────────────────────
  if (done) {
    return (
      <div
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end"
        onClick={(e) => e.target === e.currentTarget && onDone()}
      >
        <div className="w-full bg-white dark:bg-gray-900 rounded-t-3xl p-6 text-center animate-slide-up">
          <CheckCircle2 size={44} className="text-green-500 mx-auto mb-3" />
          <p className="font-bold text-xl text-gray-900 dark:text-white mb-1">Done!</p>
          <p className="text-gray-500 dark:text-gray-400 text-sm mb-5">
            Added {addedCount} book{addedCount !== 1 ? "s" : ""} from {seriesTitle}.
          </p>
          <button
            onClick={onDone}
            className="w-full py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-2xl font-semibold"
          >
            Back to library
          </button>
        </div>
      </div>
    );
  }

  // ── Main sheet ───────────────────────────────────────────────────────────────
  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end"
      onClick={(e) => e.target === e.currentTarget && onDone()}
    >
      <div
        className="w-full bg-white dark:bg-gray-900 rounded-t-3xl flex flex-col animate-slide-up"
        style={{ maxHeight: "90vh" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3 shrink-0">
          <div>
            <p className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wider font-semibold mb-0.5">
              Series
            </p>
            <p className="font-bold text-gray-900 dark:text-white">{seriesTitle}</p>
          </div>
          <button
            onClick={onDone}
            className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <X size={20} className="text-gray-400" />
          </button>
        </div>

        {/* Sub-header: loading status */}
        {!loadingList && loadingCount > 0 && (
          <div className="px-5 pb-2 shrink-0 flex items-center gap-2">
            <Loader2 size={13} className="text-blue-400 animate-spin shrink-0" />
            <p className="text-xs text-gray-400 dark:text-gray-500">
              Loading details… ({rows.length - loadingCount}/{rows.length})
            </p>
          </div>
        )}

        {/* Book list */}
        <div className="overflow-y-auto flex-1 px-5 pb-2">
          {loadingList ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 size={28} className="text-blue-400 animate-spin" />
            </div>
          ) : rows.length === 0 ? (
            <p className="text-center text-gray-400 py-10 text-sm">
              All books already in your library.
            </p>
          ) : (
            rows.map((row, idx) => {
              const editions: Edition[] = row.data?.editions ?? [];
              const selEd = editions[row.selectedEditionIdx] ?? null;
              const cover = selEd?.coverUrl || row.data?.coverUrl || "";
              const isExpanded = expandedSlug === row.slug;
              const hasEditions = editions.length > 1;

              return (
                <div key={row.slug} className="mb-1">
                  {/* Main row */}
                  <div
                    className={`flex items-center gap-3 py-2.5 rounded-xl px-1 transition-colors ${
                      row.alreadyInLibrary ? "opacity-40" : ""
                    }`}
                  >
                    {/* Cover */}
                    <div className="w-10 h-[60px] rounded-lg bg-gray-100 dark:bg-gray-800 shrink-0 overflow-hidden flex items-center justify-center">
                      {row.loading ? (
                        <Loader2 size={14} className="text-gray-400 animate-spin" />
                      ) : cover ? (
                        <img src={cover} alt={row.title} className="w-full h-full object-cover" />
                      ) : (
                        <BookOpen size={14} className="text-gray-300 dark:text-gray-600" />
                      )}
                    </div>

                    {/* Checkbox */}
                    <button
                      onClick={() => !row.alreadyInLibrary && toggleRow(idx)}
                      disabled={row.alreadyInLibrary}
                      className="shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors"
                      style={{
                        borderColor: row.selected && !row.alreadyInLibrary ? "#3b82f6" : "#d1d5db",
                        backgroundColor:
                          row.selected && !row.alreadyInLibrary ? "#3b82f6" : "transparent",
                      }}
                    >
                      {(row.selected || row.alreadyInLibrary) && (
                        <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                          <path
                            d="M1 4l3 3 5-6"
                            stroke="white"
                            strokeWidth="1.8"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      )}
                    </button>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 dark:text-white leading-snug truncate">
                        {row.data?.title || row.title}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-gray-400 dark:text-gray-500">
                          #{row.order}
                        </span>
                        {selEd?.isbn && (
                          <span className="text-xs text-gray-400 dark:text-gray-500 font-mono truncate">
                            {selEd.isbn}
                          </span>
                        )}
                        {row.alreadyInLibrary && (
                          <span className="text-xs text-green-500">in library</span>
                        )}
                      </div>
                      {selEd && (selEd.language || selEd.year) && (
                        <p className="text-xs text-blue-500 dark:text-blue-400 mt-0.5">
                          {[selEd.language, selEd.year].filter(Boolean).join(" · ")}
                        </p>
                      )}
                    </div>

                    {/* Edition expand button */}
                    {hasEditions && (
                      <button
                        onClick={() => setExpandedSlug(isExpanded ? null : row.slug)}
                        className={`shrink-0 p-1.5 rounded-lg transition-colors ${
                          isExpanded
                            ? "bg-blue-50 dark:bg-blue-900/20 text-blue-500"
                            : "text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                        }`}
                        title={`${editions.length} editions`}
                      >
                        <ChevronRight
                          size={15}
                          className={`transition-transform ${isExpanded ? "rotate-90" : ""}`}
                        />
                      </button>
                    )}
                  </div>

                  {/* Edition picker — expanded inline */}
                  {isExpanded && (
                    <div className="ml-[52px] mb-2 pb-1">
                      <p className="text-xs text-gray-400 dark:text-gray-500 mb-1.5">
                        Choose edition
                      </p>
                      <div className="flex gap-1.5 overflow-x-auto pb-1">
                        {editions.map((ed, edIdx) => (
                          <button
                            key={ed.coverUrl}
                            onClick={() => {
                              setEdition(idx, edIdx);
                              setExpandedSlug(null);
                            }}
                            title={[ed.language, ed.year, ed.isbn].filter(Boolean).join(" · ")}
                            className={`shrink-0 w-10 h-[60px] rounded-lg overflow-hidden border-2 transition-all ${
                              edIdx === row.selectedEditionIdx
                                ? "border-blue-500 ring-1 ring-blue-200 dark:ring-blue-800"
                                : "border-transparent opacity-60 hover:opacity-100"
                            }`}
                          >
                            <img
                              src={ed.coverUrl}
                              alt={`Ed. ${edIdx + 1}`}
                              className="w-full h-full object-cover"
                            />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        {!loadingList && rows.length > 0 && (
          <div className="px-5 pb-6 pt-3 border-t border-gray-100 dark:border-gray-800 shrink-0">
            <button
              onClick={handleAdd}
              disabled={adding || selectedCount === 0}
              className="w-full py-3 rounded-2xl bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white font-semibold flex items-center justify-center gap-2 transition-colors"
            >
              {adding ? (
                <>
                  <Loader2 size={16} className="animate-spin" /> Adding…
                </>
              ) : (
                <>
                  Add {selectedCount} book{selectedCount !== 1 ? "s" : ""} to library
                </>
              )}
            </button>
            <button
              onClick={onDone}
              className="w-full mt-2 text-sm text-gray-400 dark:text-gray-500 hover:text-gray-600 py-1.5 transition-colors"
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
