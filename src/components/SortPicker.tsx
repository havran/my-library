import { ArrowUpDown } from "lucide-react";
import type { BookSortField, SortDirection } from "@/types/book";

interface Props {
  sortField: BookSortField;
  sortDirection: SortDirection;
  onSortFieldChange: (f: BookSortField) => void;
  onSortDirectionChange: (d: SortDirection) => void;
}

const FIELDS: { value: BookSortField; label: string }[] = [
  { value: "addedAt", label: "Date Added" },
  { value: "title", label: "Title" },
  { value: "authors", label: "Author" },
  { value: "genres", label: "Genre" },
];

export function SortPicker({
  sortField,
  sortDirection,
  onSortFieldChange,
  onSortDirectionChange,
}: Props) {
  return (
    <div className="flex items-center gap-2 mt-2">
      <ArrowUpDown size={14} className="text-gray-400 shrink-0" />
      <select
        value={sortField}
        onChange={(e) => onSortFieldChange(e.target.value as BookSortField)}
        className="text-sm bg-transparent text-gray-600 dark:text-gray-300 cursor-pointer focus:outline-none"
      >
        {FIELDS.map((f) => (
          <option key={f.value} value={f.value}>
            {f.label}
          </option>
        ))}
      </select>
      <button
        onClick={() => onSortDirectionChange(sortDirection === "asc" ? "desc" : "asc")}
        className="text-xs text-gray-500 dark:text-gray-400 hover:text-blue-500 font-medium transition-colors"
      >
        {sortDirection === "asc" ? "↑ Asc" : "↓ Desc"}
      </button>
    </div>
  );
}
