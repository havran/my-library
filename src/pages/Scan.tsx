import { useState, useRef, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Zap,
  ZapOff,
  ScanLine,
  PenLine,
  Search,
  Camera,
  X,
  BookOpen,
  Loader2,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { useLibraryStore } from "@/store/useLibraryStore";
import { fetchByISBN, searchByText } from "@/services/bookApi";
import { searchByOCR } from "@/services/coverSearch";
import { fetchImageAsBase64 } from "@/services/imageCache";
import { generateId } from "@/utils/helpers";
import { BookPreview } from "@/components/BookPreview";
import { ManualAddForm } from "@/components/ManualAddForm";
import type { Book, BookSearchResult } from "@/types/book";

type ScanMode = "barcode" | "cover" | "manual";
type ToastType = "error" | "info" | "success";
type ToastState = { msg: string; type: ToastType } | null;

export default function Scan() {
  const navigate = useNavigate();
  const { addBook, books } = useLibraryStore();

  const [mode, setMode] = useState<ScanMode>("barcode");
  const [torch, setTorch] = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [isOcrScanning, setIsOcrScanning] = useState(false);

  const [previewData, setPreviewData] = useState<BookSearchResult | null>(null);
  const [searchResults, setSearchResults] = useState<BookSearchResult[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [showManual, setShowManual] = useState(false);
  const [showTextSearch, setShowTextSearch] = useState(false);
  const [coverQuery, setCoverQuery] = useState("");
  const [manualISBN, setManualISBN] = useState("");
  const [toast, setToast] = useState<ToastState>(null);

  // Two separate video refs: one for barcode mode, one for cover mode
  const barcodeVideoRef = useRef<HTMLVideoElement>(null);
  const coverVideoRef = useRef<HTMLVideoElement>(null);
  const barcodeScannerRef = useRef<{ stop: () => void } | null>(null);
  const coverStreamRef = useRef<MediaStream | null>(null);

  // Ref-based values for scanner callbacks (avoids stale closures)
  const scannedRef = useRef(false);
  const isLoadingRef = useRef(false);
  const torchRef = useRef(false);
  const booksRef = useRef(books);

  useEffect(() => { booksRef.current = books; }, [books]);
  useEffect(() => { isLoadingRef.current = isLoading; }, [isLoading]);
  useEffect(() => { torchRef.current = torch; }, [torch]);

  // ── Toast ─────────────────────────────────────────────────────────────────
  const showToast = useCallback((msg: string, type: ToastType = "info") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  }, []);

  // ── Add book ──────────────────────────────────────────────────────────────
  const handleAddBook = useCallback(async (data: BookSearchResult, source: Book["source"]) => {
    setIsAdding(true);
    const coverBase64 = await fetchImageAsBase64(data.coverUrl);
    const book: Book = {
      id: generateId(),
      isbn: data.isbn,
      title: data.title,
      authors: data.authors,
      genres: data.genres,
      description: data.description,
      publisher: data.publisher,
      pageCount: data.pageCount,
      series: "",
      seriesNumber: "",
      coverUrl: data.coverUrl,
      coverBase64,
      averageRating: data.averageRating,
      ratingsCount: data.ratingsCount,
      isRead: false,
      notes: "",
      source,
      addedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await addBook(book);
    setIsAdding(false);
    setPreviewData(null);
    setShowResults(false);
    scannedRef.current = false;
    showToast(`"${book.title}" added to library!`, "success");
  }, [addBook, showToast]);

  // ── ISBN lookup ───────────────────────────────────────────────────────────
  const handleISBN = useCallback(async (isbn: string, source: Book["source"]) => {
    const trimmed = isbn.trim();
    if (!trimmed) return;
    setIsLoading(true);
    const existing = booksRef.current.find((b) => b.isbn === trimmed);
    if (existing) {
      showToast(`Already in library: "${existing.title}"`, "info");
      setIsLoading(false);
      scannedRef.current = false;
      return;
    }
    const result = await fetchByISBN(trimmed);
    setIsLoading(false);
    if (result) {
      setPreviewData(result);
    } else {
      showToast(`No book found for ISBN ${trimmed}`, "error");
      scannedRef.current = false;
    }
  }, [showToast]);

  // ── Barcode scanner ───────────────────────────────────────────────────────
  const stopBarcodeScanner = useCallback(() => {
    if (barcodeScannerRef.current) {
      barcodeScannerRef.current.stop();
      barcodeScannerRef.current = null;
    }
    const video = barcodeVideoRef.current;
    if (video?.srcObject) {
      (video.srcObject as MediaStream).getTracks().forEach((t) => t.stop());
      video.srcObject = null;
    }
  }, []);

  const startBarcodeScanner = useCallback(async () => {
    if (!barcodeVideoRef.current) return;
    scannedRef.current = false;

    const { BrowserMultiFormatReader } = await import("@zxing/browser");
    const { NotFoundException } = await import("@zxing/library");

    const reader = new BrowserMultiFormatReader();
    try {
      const controls = await reader.decodeFromConstraints(
        { video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } } },
        barcodeVideoRef.current,
        async (result, error) => {
          if (error && !(error instanceof NotFoundException)) return;
          if (!result || scannedRef.current || isLoadingRef.current) return;
          scannedRef.current = true;
          await handleISBN(result.getText(), "scan");
        }
      );
      barcodeScannerRef.current = controls as unknown as { stop: () => void };
      if (torchRef.current) await applyTorch(barcodeVideoRef.current, true);
    } catch (err: any) {
      if (err?.name === "NotAllowedError" || err?.message?.includes("ermission")) {
        setPermissionDenied(true);
      } else {
        showToast("Camera error: " + (err?.message ?? "unknown"), "error");
      }
    }
  }, [handleISBN, showToast]);

  // ── Cover camera ──────────────────────────────────────────────────────────
  const stopCoverCamera = useCallback(() => {
    coverStreamRef.current?.getTracks().forEach((t) => t.stop());
    coverStreamRef.current = null;
    const video = coverVideoRef.current;
    if (video) video.srcObject = null;
  }, []);

  const startCoverCamera = useCallback(async () => {
    if (!coverVideoRef.current) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } },
      });
      coverStreamRef.current = stream;
      coverVideoRef.current.srcObject = stream;
    } catch (err: any) {
      if (err?.name === "NotAllowedError") setPermissionDenied(true);
      else showToast("Camera error: " + (err?.message ?? "unknown"), "error");
    }
  }, [showToast]);

  // ── Mode transitions ──────────────────────────────────────────────────────
  useEffect(() => {
    if (mode === "barcode") {
      stopCoverCamera();
      startBarcodeScanner();
      return () => { stopBarcodeScanner(); };
    } else if (mode === "cover") {
      stopBarcodeScanner();
      startCoverCamera();
      return () => { stopCoverCamera(); };
    } else {
      stopBarcodeScanner();
      stopCoverCamera();
    }
  }, [mode]); // eslint-disable-line react-hooks/exhaustive-deps
  // startBarcodeScanner / stopBarcodeScanner / startCoverCamera / stopCoverCamera
  // are stable (useCallback with no deps that change), so omitting from deps is safe.

  // ── Torch ─────────────────────────────────────────────────────────────────
  async function applyTorch(video: HTMLVideoElement, on: boolean) {
    const track = (video.srcObject as MediaStream | null)?.getVideoTracks()[0];
    if (!track) return;
    const cap = track.getCapabilities() as any;
    if (cap?.torch) {
      try { await (track as any).applyConstraints({ advanced: [{ torch: on }] }); } catch {}
    }
  }

  const toggleTorch = async () => {
    const newVal = !torch;
    setTorch(newVal);
    torchRef.current = newVal;
    const video = mode === "barcode" ? barcodeVideoRef.current : coverVideoRef.current;
    if (video) await applyTorch(video, newVal);
  };

  // ── Capture cover photo from live camera ──────────────────────────────────
  const handleCaptureAndOCR = async () => {
    const video = coverVideoRef.current;
    if (!video || !coverStreamRef.current) return;

    setIsOcrScanning(true);
    // Draw current frame to canvas and extract blob
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")!.drawImage(video, 0, 0);

    const url = canvas.toDataURL("image/jpeg", 0.85);
    const results = await searchByOCR(url);
    setIsOcrScanning(false);

    if (results.length > 0) {
      setSearchResults(results);
      setShowResults(true);
    } else {
      showToast("Couldn't read text from frame. Try adjusting the angle or use text search below.", "error");
    }
  };

  // ── Cover text search ─────────────────────────────────────────────────────
  const handleCoverTextSearch = async () => {
    const q = coverQuery.trim();
    if (!q) return;
    setIsLoading(true);
    const results = await searchByText(q);
    setIsLoading(false);
    if (results.length > 0) {
      setSearchResults(results);
      setShowResults(true);
    } else {
      showToast("No results found. Try different keywords.", "error");
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 bg-black flex flex-col z-50">

      {/* ── Top bar ─────────────────────────────────────────────────── */}
      <div className="absolute top-0 inset-x-0 z-20 flex items-center justify-between px-4 pt-4 pb-3 bg-gradient-to-b from-black/70 to-transparent">
        <button
          onClick={() => { stopBarcodeScanner(); stopCoverCamera(); navigate(-1); }}
          className="p-2 rounded-full bg-black/40 text-white hover:bg-black/60 transition-colors"
          aria-label="Back"
        >
          <ArrowLeft size={22} />
        </button>

        <div className="flex bg-black/50 backdrop-blur rounded-full p-1 gap-1">
          {(["barcode", "cover", "manual"] as ScanMode[]).map((m) => (
            <button
              key={m}
              onClick={() => { setMode(m); scannedRef.current = false; setPermissionDenied(false); }}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                mode === m ? "bg-white text-black" : "text-white/70 hover:text-white"
              }`}
            >
              {m === "barcode" ? "Barcode" : m === "cover" ? "Cover" : "Manual"}
            </button>
          ))}
        </div>

        <button
          onClick={toggleTorch}
          className="p-2 rounded-full bg-black/40 text-white hover:bg-black/60 transition-colors"
          aria-label={torch ? "Torch off" : "Torch on"}
        >
          {torch ? <ZapOff size={20} /> : <Zap size={20} />}
        </button>
      </div>

      {/* ── BARCODE MODE ────────────────────────────────────────────── */}
      {mode === "barcode" && (
        <>
          {permissionDenied ? (
            <PermissionDenied onManual={() => setMode("manual")} />
          ) : (
            <>
              <video
                ref={barcodeVideoRef}
                className="absolute inset-0 w-full h-full object-cover"
                playsInline muted autoPlay
              />
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <div className="relative w-72 h-40">
                  {["top-0 left-0 border-t-2 border-l-2","top-0 right-0 border-t-2 border-r-2","bottom-0 left-0 border-b-2 border-l-2","bottom-0 right-0 border-b-2 border-r-2"].map((cls, i) => (
                    <div key={i} className={`absolute w-6 h-6 border-white rounded-sm ${cls}`} />
                  ))}
                  <div className="absolute inset-x-0 top-0 overflow-hidden h-full">
                    <div className="h-0.5 bg-blue-400/80 animate-scan-line" />
                  </div>
                </div>
                <p className="text-white/80 text-sm mt-5 bg-black/40 px-4 py-1.5 rounded-full">
                  Point at a book barcode (EAN-13)
                </p>
              </div>

              {isLoading && (
                <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center gap-3">
                  <Loader2 size={36} className="text-white animate-spin" />
                  <p className="text-white font-medium">Looking up book…</p>
                </div>
              )}

              <div className="absolute bottom-8 inset-x-0 flex justify-center pointer-events-none">
                <ScanLine size={28} className="text-white/30" />
              </div>
            </>
          )}
        </>
      )}

      {/* ── COVER MODE: live camera + capture ───────────────────────── */}
      {mode === "cover" && (
        <>
          {permissionDenied ? (
            <PermissionDenied onManual={() => setMode("manual")} />
          ) : (
            <>
              {/* Live camera preview */}
              <video
                ref={coverVideoRef}
                className="absolute inset-0 w-full h-full object-cover"
                playsInline muted autoPlay
              />

              {/* Vignette overlay */}
              <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/60 pointer-events-none" />

              {/* Instruction */}
              <div className="absolute top-20 inset-x-0 flex justify-center pointer-events-none">
                <p className="text-white/80 text-sm bg-black/40 px-4 py-1.5 rounded-full">
                  Frame the book cover, then tap capture
                </p>
              </div>

              {/* Capture button */}
              <div className="absolute bottom-0 inset-x-0 flex flex-col items-center pb-10 gap-4">
                <button
                  onClick={handleCaptureAndOCR}
                  disabled={isOcrScanning}
                  className="w-18 h-18 rounded-full border-4 border-white bg-white/20 hover:bg-white/30 active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center shadow-xl"
                  style={{ width: 72, height: 72 }}
                  aria-label="Capture cover"
                >
                  {isOcrScanning ? (
                    <Loader2 size={28} className="text-white animate-spin" />
                  ) : (
                    <div className="w-14 h-14 rounded-full bg-white" />
                  )}
                </button>
                {isOcrScanning && (
                  <p className="text-white/80 text-sm animate-pulse">Reading text from cover…</p>
                )}
              </div>

              {/* Text search — collapsed by default, expand on tap */}
              <div className="absolute bottom-0 inset-x-0">
                <div className="absolute bottom-0 inset-x-0 bg-black/70 backdrop-blur rounded-t-3xl transition-all"
                  style={{ transform: showTextSearch ? "translateY(0)" : "translateY(calc(100% - 48px))" }}>
                  <button
                    onClick={() => setShowTextSearch((v) => !v)}
                    className="w-full flex items-center justify-center gap-2 py-3 text-white/60 text-sm"
                  >
                    {showTextSearch ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
                    {showTextSearch ? "Hide text search" : "Search by title instead"}
                  </button>
                  <div className="px-4 pb-6 flex gap-2">
                    <input
                      value={coverQuery}
                      onChange={(e) => setCoverQuery(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleCoverTextSearch()}
                      placeholder='e.g. "The Great Gatsby Fitzgerald"'
                      className="flex-1 px-4 py-3 bg-white/10 border border-white/20 rounded-2xl text-white placeholder-white/40 focus:outline-none focus:border-blue-400 text-sm"
                    />
                    <button
                      onClick={handleCoverTextSearch}
                      disabled={isLoading || !coverQuery.trim()}
                      className="px-4 py-3 bg-blue-500 hover:bg-blue-600 disabled:opacity-50 rounded-2xl text-white transition-colors"
                    >
                      {isLoading ? <Loader2 size={20} className="animate-spin" /> : <Search size={20} />}
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}
        </>
      )}

      {/* ── MANUAL MODE ─────────────────────────────────────────────── */}
      {mode === "manual" && (
        <div className="flex-1 overflow-y-auto pt-20 pb-10 px-5 flex flex-col gap-4">
          <div className="bg-white/10 backdrop-blur rounded-3xl p-5 border border-white/20">
            <p className="text-white font-semibold mb-3">Look up by ISBN</p>
            <div className="flex gap-2">
              <input
                value={manualISBN}
                onChange={(e) => setManualISBN(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleISBN(manualISBN, "scan")}
                placeholder="e.g. 9780743273565"
                inputMode="numeric"
                className="flex-1 px-4 py-3 bg-white/10 border border-white/20 rounded-2xl text-white placeholder-white/40 focus:outline-none focus:border-blue-400 text-sm"
              />
              <button
                onClick={() => handleISBN(manualISBN, "scan")}
                disabled={isLoading || !manualISBN.trim()}
                className="px-4 py-3 bg-blue-500 hover:bg-blue-600 disabled:opacity-50 rounded-2xl text-white transition-colors"
              >
                {isLoading ? <Loader2 size={20} className="animate-spin" /> : <Search size={20} />}
              </button>
            </div>
          </div>

          <div className="flex items-center gap-3 text-white/40 text-sm">
            <div className="flex-1 h-px bg-white/20" />or<div className="flex-1 h-px bg-white/20" />
          </div>

          <button
            onClick={() => setShowManual(true)}
            className="w-full flex items-center gap-4 bg-white/10 backdrop-blur rounded-3xl p-5 border border-white/20 text-left hover:bg-white/15 transition-colors"
          >
            <div className="w-12 h-12 rounded-2xl bg-blue-500/30 flex items-center justify-center">
              <PenLine size={22} className="text-blue-300" />
            </div>
            <div>
              <p className="text-white font-semibold">Add Manually</p>
              <p className="text-white/60 text-sm">Fill in all book details by hand</p>
            </div>
          </button>
        </div>
      )}

      {/* ── Toast ───────────────────────────────────────────────────── */}
      {toast && (
        <div className={`absolute bottom-10 inset-x-4 flex items-center justify-between gap-3 px-4 py-3 rounded-2xl text-sm font-medium shadow-lg animate-fade-in ${
          toast.type === "error"   ? "bg-red-500 text-white"
          : toast.type === "success" ? "bg-green-500 text-white"
          : "bg-gray-800 text-white"
        }`}>
          {toast.msg}
          <button onClick={() => setToast(null)} aria-label="Dismiss"><X size={16} className="opacity-70" /></button>
        </div>
      )}

      {/* ── Book Preview modal ───────────────────────────────────────── */}
      {previewData && (
        <BookPreview
          data={previewData}
          isAdding={isAdding}
          onAdd={() => handleAddBook(previewData, mode === "barcode" ? "scan" : "cover")}
          onCancel={() => { setPreviewData(null); scannedRef.current = false; }}
        />
      )}

      {/* ── Search Results sheet ─────────────────────────────────────── */}
      {showResults && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end"
          onClick={(e) => e.target === e.currentTarget && setShowResults(false)}
        >
          <div className="w-full bg-white dark:bg-gray-900 rounded-t-3xl max-h-[75vh] flex flex-col animate-slide-up">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-800">
              <span className="font-bold text-gray-900 dark:text-white">Select the correct book</span>
              <button onClick={() => setShowResults(false)}><X size={20} className="text-gray-400" /></button>
            </div>
            <div className="overflow-y-auto flex-1">
              {searchResults.map((r, i) => (
                <button
                  key={i}
                  onClick={() => { setShowResults(false); setPreviewData(r); }}
                  className="w-full flex items-start gap-3 px-5 py-3 hover:bg-gray-50 dark:hover:bg-gray-800 text-left transition-colors"
                >
                  <div className="w-10 h-14 shrink-0 rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-800">
                    {r.coverUrl
                      ? <img src={r.coverUrl} alt="" className="w-full h-full object-cover" />
                      : <div className="w-full h-full flex items-center justify-center"><BookOpen size={14} className="text-gray-400" /></div>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 dark:text-white text-sm truncate">{r.title}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{r.authors.join(", ")}</p>
                    {r.publisher && <p className="text-xs text-gray-400 dark:text-gray-500 truncate">{r.publisher}</p>}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {showManual && <ManualAddForm onClose={() => setShowManual(false)} />}
    </div>
  );
}

// ── Shared permission-denied state ───────────────────────────────────────────
function PermissionDenied({ onManual }: { onManual: () => void }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-white px-8 text-center gap-4">
      <Camera size={52} className="text-white/40" />
      <p className="text-lg font-semibold">Camera access denied</p>
      <p className="text-sm text-white/60">
        Allow camera access in your browser settings, then reload.
      </p>
      <button onClick={onManual} className="mt-2 text-blue-400 font-medium underline">
        Switch to manual entry
      </button>
    </div>
  );
}
