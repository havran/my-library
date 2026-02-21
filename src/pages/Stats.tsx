import { useLibraryStore } from "@/store/useLibraryStore";
import { getGenreCounts } from "@/utils/helpers";
import { EmptyState } from "@/components/EmptyState";
import { Download, Upload } from "lucide-react";
import { useState } from "react";

// ── Colours ───────────────────────────────────────────────────────────────────
const PALETTE = [
  "#3b82f6","#10b981","#f59e0b","#ef4444","#8b5cf6",
  "#06b6d4","#ec4899","#84cc16","#f97316","#6366f1",
];

// ── Mini SVG Pie Chart ────────────────────────────────────────────────────────
function PieChart({ data }: { data: { label: string; value: number }[] }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  if (total === 0 || data.length === 0) return null;

  const SIZE = 160;
  const R = 62;
  const CX = SIZE / 2;
  const CY = SIZE / 2;

  let angle = -Math.PI / 2;
  const segments = data.map((d, i) => {
    const sweep = (d.value / total) * 2 * Math.PI;
    const x1 = CX + R * Math.cos(angle);
    const y1 = CY + R * Math.sin(angle);
    angle += sweep;
    const x2 = CX + R * Math.cos(angle);
    const y2 = CY + R * Math.sin(angle);
    const large = sweep > Math.PI ? 1 : 0;
    const path = `M ${CX} ${CY} L ${x1.toFixed(2)} ${y1.toFixed(2)} A ${R} ${R} 0 ${large} 1 ${x2.toFixed(2)} ${y2.toFixed(2)} Z`;
    return { path, color: PALETTE[i % PALETTE.length], label: d.label };
  });

  return (
    <svg viewBox={`0 0 ${SIZE} ${SIZE}`} width={SIZE} height={SIZE} className="mx-auto">
      {segments.map((s, i) => (
        <path key={i} d={s.path} fill={s.color} stroke="white" strokeWidth="2" />
      ))}
      {/* Donut hole */}
      <circle cx={CX} cy={CY} r={30} fill="white" className="dark:fill-gray-900" />
    </svg>
  );
}

// ── Stat Card ─────────────────────────────────────────────────────────────────
function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-white dark:bg-gray-900 rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-gray-800 ${className}`}>
      {children}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function Stats() {
  const { books, exportBooks, importBooks } = useLibraryStore();
  const [toast, setToast] = useState("");

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  };

  if (books.length === 0) {
    return <EmptyState title="No stats yet" description="Add some books to see your reading stats." />;
  }

  const totalBooks = books.length;
  const readBooks = books.filter((b) => b.isRead).length;
  const unreadBooks = totalBooks - readBooks;
  const totalPages = books.reduce((s, b) => s + (b.pageCount || 0), 0);
  const ratedBooks = books.filter((b) => b.averageRating);
  const avgRating =
    ratedBooks.length > 0
      ? (ratedBooks.reduce((s, b) => s + (b.averageRating || 0), 0) / ratedBooks.length).toFixed(1)
      : null;

  const genreCounts = getGenreCounts(books);
  const topGenres = Object.entries(genreCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);
  const pieData = topGenres.map(([label, value]) => ({ label, value }));

  // Export
  const handleExport = async () => {
    try {
      const json = await exportBooks();
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `my-library-${new Date().toISOString().split("T")[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      showToast(`${JSON.parse(json).length} books exported.`);
    } catch {
      showToast("Export failed.");
    }
  };

  // Import
  const handleImport = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const count = await importBooks(text);
        showToast(`${count} books imported.`);
      } catch {
        showToast("Import failed — invalid file.");
      }
    };
    input.click();
  };

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <h1 className="text-xl font-bold text-gray-900 dark:text-white">Stats</h1>

      {/* Summary grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Total Books", value: totalBooks, color: "text-blue-500" },
          { label: "Read", value: readBooks, color: "text-green-500" },
          { label: "Pages", value: totalPages.toLocaleString(), color: "text-amber-500" },
          { label: "Avg Rating", value: avgRating ?? "—", color: "text-purple-500" },
        ].map((s) => (
          <Card key={s.label}>
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{s.label}</p>
          </Card>
        ))}
      </div>

      {/* Reading progress */}
      <Card>
        <p className="font-semibold text-gray-900 dark:text-white mb-3">Reading Progress</p>
        <div className="flex h-8 rounded-full overflow-hidden bg-gray-100 dark:bg-gray-800">
          {readBooks > 0 && (
            <div
              className="bg-green-500 flex items-center justify-center text-white text-xs font-bold"
              style={{ width: `${(readBooks / totalBooks) * 100}%` }}
            >
              {readBooks / totalBooks > 0.15 && `${readBooks} read`}
            </div>
          )}
          {unreadBooks > 0 && (
            <div
              className="bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-gray-600 dark:text-gray-300 text-xs font-bold"
              style={{ width: `${(unreadBooks / totalBooks) * 100}%` }}
            >
              {unreadBooks / totalBooks > 0.15 && `${unreadBooks} unread`}
            </div>
          )}
        </div>
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
          {Math.round((readBooks / totalBooks) * 100)}% completed
        </p>
      </Card>

      {/* Genre chart */}
      {topGenres.length > 0 && (
        <Card>
          <p className="font-semibold text-gray-900 dark:text-white mb-4">Books by Genre</p>
          <PieChart data={pieData} />
          <div className="mt-5 space-y-2">
            {topGenres.map(([genre, count], i) => (
              <div key={genre} className="flex items-center gap-3">
                <span
                  className="w-3 h-3 rounded-full shrink-0"
                  style={{ background: PALETTE[i % PALETTE.length] }}
                />
                <span className="flex-1 text-sm text-gray-700 dark:text-gray-300 truncate">{genre}</span>
                <span className="text-sm font-semibold text-gray-900 dark:text-white">{count}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Recent additions */}
      <Card>
        <p className="font-semibold text-gray-900 dark:text-white mb-3">Recently Added</p>
        <div className="divide-y divide-gray-100 dark:divide-gray-800">
          {[...books]
            .sort((a, b) => b.addedAt.localeCompare(a.addedAt))
            .slice(0, 5)
            .map((b) => (
              <div key={b.id} className="flex items-center justify-between py-2.5 gap-3">
                <span className="text-sm text-gray-900 dark:text-white font-medium truncate">{b.title}</span>
                <span className="text-xs text-gray-400 dark:text-gray-500 shrink-0">
                  {new Date(b.addedAt).toLocaleDateString()}
                </span>
              </div>
            ))}
        </div>
      </Card>

      {/* Export / Import */}
      <Card>
        <p className="font-semibold text-gray-900 dark:text-white mb-3">Backup & Restore</p>
        <div className="flex gap-3">
          <button
            onClick={handleExport}
            className="flex-1 flex items-center justify-center gap-2 py-3 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-xl text-sm font-semibold hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
          >
            <Download size={16} />
            Export JSON
          </button>
          <button
            onClick={handleImport}
            className="flex-1 flex items-center justify-center gap-2 py-3 bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 rounded-xl text-sm font-semibold hover:bg-green-100 dark:hover:bg-green-900/30 transition-colors"
          >
            <Upload size={16} />
            Import JSON
          </button>
        </div>
      </Card>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-24 md:bottom-6 inset-x-4 mx-auto max-w-sm px-4 py-3 bg-gray-900 dark:bg-gray-700 text-white text-sm font-medium rounded-2xl text-center shadow-xl animate-fade-in">
          {toast}
        </div>
      )}
    </div>
  );
}
