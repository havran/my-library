import { useNavigate } from "react-router-dom";
import { BookOpen, Camera } from "lucide-react";

interface Props {
  title?: string;
  description?: string;
  showScanButton?: boolean;
}

export function EmptyState({
  title = "Your library is empty",
  description = "Scan a barcode or search by cover to add your first book.",
  showScanButton = true,
}: Props) {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col items-center justify-center py-20 text-center px-6">
      <div className="w-20 h-20 rounded-2xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center mb-6">
        <BookOpen size={36} className="text-blue-400" />
      </div>
      <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">{title}</h3>
      <p className="text-gray-500 dark:text-gray-400 max-w-xs">{description}</p>
      {showScanButton && (
        <button
          onClick={() => navigate("/scan")}
          className="mt-8 flex items-center gap-2 bg-blue-500 hover:bg-blue-600 text-white px-6 py-3 rounded-xl font-semibold transition-colors"
        >
          <Camera size={18} />
          Scan a Book
        </button>
      )}
    </div>
  );
}
