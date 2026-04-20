import { X } from "lucide-react";

interface Props {
  covers: string[];
  onSelect: (url: string) => void;
  onClose: () => void;
}

export function CoverPicker({ covers, onSelect, onClose }: Props) {
  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white dark:bg-gray-900 rounded-3xl p-5 w-full max-w-sm shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <p className="font-semibold text-gray-900 dark:text-white text-sm">
            Vyber obálku
            <span className="ml-2 text-xs font-normal text-gray-400">({covers.length})</span>
          </p>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <X size={16} />
          </button>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {covers.map((url) => (
            <button
              key={url}
              onClick={() => onSelect(url)}
              className="aspect-[2/3] rounded-xl overflow-hidden bg-gray-100 dark:bg-gray-800 hover:ring-2 hover:ring-blue-500 active:scale-95 transition-all"
            >
              <img src={url} alt="" className="w-full h-full object-cover" loading="lazy" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
