"use client";

import { useCallback, useEffect, useRef, useState, type UIEvent } from "react";
import {
  ImagePlus,
  Search,
  X,
  Loader2,
  Images,
  ImageOff,
  Pencil,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { QuestionImage } from "@/types";

interface UnsplashResult extends QuestionImage {
  id: string;
}

interface ImagePickerProps {
  image?: QuestionImage | null;
  onChange: (image: QuestionImage | null) => void;
}

export function ImagePicker({ image, onChange }: ImagePickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeQuery, setActiveQuery] = useState("");
  const [results, setResults] = useState<UnsplashResult[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [searched, setSearched] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const loadingMoreRef = useRef(false);
  const requestedQueryRef = useRef("");
  const searchSeqRef = useRef(0);

  const runSearch = useCallback(async (q: string) => {
    const seq = ++searchSeqRef.current;
    requestedQueryRef.current = q;

    setLoading(true);
    setError("");
    setResults([]);
    setPage(1);
    setTotalPages(1);
    setSearched(true);

    try {
      const res = await fetch(
        `/api/unsplash/search?query=${encodeURIComponent(q)}&page=1`
      );
      const data = await res.json();
      if (seq !== searchSeqRef.current) return;

      if (!res.ok) {
        if (data.error === "missing_key") {
          setError(
            "Falta configurar UNSPLASH_ACCESS_KEY en .env.local. Crea una app gratis en unsplash.com/developers"
          );
        } else if (typeof data.message === "string" && data.message) {
          setError(data.message);
        } else {
          setError("No se pudo buscar imágenes. Intenta de nuevo.");
        }
        setResults([]);
        return;
      }

      setResults(data.results || []);
      setTotalPages(data.totalPages || 1);
      setActiveQuery(q);
      if (scrollRef.current) scrollRef.current.scrollTop = 0;
    } catch {
      if (seq !== searchSeqRef.current) return;
      setError("Error de conexión al buscar imágenes.");
      setResults([]);
    } finally {
      if (seq === searchSeqRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    const q = query.trim();
    if (!q || q === requestedQueryRef.current) return;
    const timer = setTimeout(() => runSearch(q), 1000);
    return () => clearTimeout(timer);
  }, [open, query, runSearch]);

  const loadMore = async () => {
    if (loading || loadingMoreRef.current || page >= totalPages) return;
    const q = activeQuery;
    if (!q) return;

    const next = page + 1;
    loadingMoreRef.current = true;
    setLoadingMore(true);

    try {
      const res = await fetch(
        `/api/unsplash/search?query=${encodeURIComponent(q)}&page=${next}`
      );
      // best-effort: sin body si la respuesta no es JSON (se evalúa res.ok después)
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        if (data && typeof data.message === "string") setError(data.message);
        return;
      }
      setResults((prev) => [...prev, ...((data?.results as UnsplashResult[]) || [])]);
      setPage(next);
      setTotalPages(data?.totalPages || totalPages);
    } catch {
      // se reintenta al seguir scrolleando
    } finally {
      loadingMoreRef.current = false;
      setLoadingMore(false);
    }
  };

  const handleScroll = (e: UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 400) {
      loadMore();
    }
  };

  const select = (result: UnsplashResult) => {
    onChange({
      url: result.url,
      thumb: result.thumb,
      alt: result.alt,
      author: result.author,
      authorLink: result.authorLink,
    });
    setOpen(false);
  };

  const hasMore = results.length > 0 && page < totalPages;

  return (
    <div>
      {image ? (
        <div className="relative inline-block">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={image.thumb || image.url}
            alt=""
            className="h-24 w-36 object-cover rounded-xl border-2 border-gray-200"
          />
          <div className="absolute top-1.5 right-1.5 flex gap-1">
            <button
              type="button"
              onClick={() => setOpen(true)}
              title="Cambiar imagen"
              className="p-1.5 rounded-lg bg-black/50 text-white hover:bg-[#1368CE] transition-colors"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => onChange(null)}
              title="Quitar imagen"
              className="p-1.5 rounded-lg bg-black/50 text-white hover:bg-[#E21B3C] transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-gray-600 bg-white border-2 border-dashed border-gray-300 hover:border-[#864CBF] hover:text-[#864CBF] rounded-xl transition-colors"
        >
          <ImagePlus className="h-4 w-4" />
          Añadir imagen (opcional)
        </button>
      )}

      <Dialog open={open} onOpenChange={setOpen} modal={false}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Images className="h-5 w-5 text-[#864CBF]" />
              Buscar imagen
            </DialogTitle>
            <DialogDescription>
              Las imágenes se buscan solas al dejar de escribir. Gratis de
              Unsplash, con crédito automático al autor.
            </DialogDescription>
          </DialogHeader>

          <div className="relative shrink-0">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input
              autoFocus
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  const q = query.trim();
                  if (q) runSearch(q);
                }
              }}
              placeholder="Buscar imágenes en Unsplash..."
              className="w-full pl-9 pr-10 py-2.5 text-sm font-medium border-2 border-gray-200 rounded-xl focus:border-[#1368CE] focus:ring-2 focus:ring-[#1368CE]/20 outline-none"
            />
            {loading && (
              <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-[#1368CE]" />
            )}
          </div>

          {error && (
            <p className="text-sm text-[#E21B3C] font-medium shrink-0">
              {error}
            </p>
          )}

          {(loading || results.length > 0) && (
            <div
              ref={scrollRef}
              onScroll={handleScroll}
              className="grid grid-cols-2 gap-2.5 content-start auto-rows-max overflow-y-auto overscroll-contain min-h-0 pr-1"
            >
              {results.map((result) => (
                <button
                  key={result.id}
                  type="button"
                  onClick={() => select(result)}
                  className="relative rounded-xl overflow-hidden border-2 border-transparent hover:border-[#864CBF] transition-colors group"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={result.thumb || result.url}
                    alt=""
                    loading="lazy"
                    className="w-full h-48 sm:h-56 object-cover group-hover:scale-105 transition-transform"
                  />
                </button>
              ))}

              {(loading || loadingMore) &&
                Array.from({ length: loading ? 6 : 4 }).map((_, i) => (
                  <div
                    key={`skeleton-${i}`}
                    className="h-48 sm:h-56 rounded-xl bg-gray-200 animate-pulse"
                  />
                ))}

              {!loading && !loadingMore && results.length > 0 && !hasMore && (
                <p className="col-span-full text-center text-xs text-gray-400 py-2">
                  No hay más imágenes
                </p>
              )}
            </div>
          )}

          {!loading && searched && results.length === 0 && !error && (
            <div className="flex flex-col items-center justify-center gap-2 py-12 text-gray-400">
              <ImageOff className="h-8 w-8" />
              <p className="text-sm font-medium">
                Sin resultados para esa búsqueda.
              </p>
            </div>
          )}

          {!loading && !searched && !error && (
            <div className="flex flex-col items-center justify-center gap-2 py-12 text-gray-400">
              <ImagePlus className="h-8 w-8" />
              <p className="text-sm font-medium">
                Escribe algo y espera un segundo: la búsqueda se hace sola.
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
