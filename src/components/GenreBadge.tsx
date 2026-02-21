const GENRE_COLORS: Record<string, string> = {
  fiction:       "bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300",
  "science fiction": "bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300",
  fantasy:       "bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300",
  mystery:       "bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-300",
  thriller:      "bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300",
  romance:       "bg-pink-100 dark:bg-pink-900/40 text-pink-700 dark:text-pink-300",
  horror:        "bg-gray-800 dark:bg-gray-700 text-gray-100",
  biography:     "bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300",
  history:       "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300",
  science:       "bg-cyan-100 dark:bg-cyan-900/40 text-cyan-700 dark:text-cyan-300",
};

function getGenreColor(genre: string): string {
  const lower = genre.toLowerCase();
  for (const [key, cls] of Object.entries(GENRE_COLORS)) {
    if (lower.includes(key)) return cls;
  }
  return "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300";
}

interface Props {
  genre: string;
  size?: "sm" | "md";
}

export function GenreBadge({ genre, size = "sm" }: Props) {
  const colorClass = getGenreColor(genre);
  const sizeClass = size === "md" ? "px-3 py-1 text-sm" : "px-2 py-0.5 text-xs";

  return (
    <span className={`inline-block rounded-full font-medium ${colorClass} ${sizeClass}`}>
      {genre}
    </span>
  );
}
