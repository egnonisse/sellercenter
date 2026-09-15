"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";

const MAX_IMAGES = 8;

const inputCls =
  "w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring dark:border-zinc-800 dark:bg-zinc-950";

// Gestion visuelle des images produit : vignettes, ordre (↑/↓), suppression, upload, URL.
// Envoie la liste finale (JSON) dans un champ caché `images` pour la server action.
export function ImageList({ initial = [] }: { initial?: string[] }) {
  const [images, setImages] = useState<string[]>(initial.slice(0, MAX_IMAGES));
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    setBusy(true);
    setError("");
    try {
      if (images.length >= MAX_IMAGES) {
        setError(`Maximum ${MAX_IMAGES} images.`);
        return;
      }
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/products/image/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Upload échoué");
      setImages((prev) => [...prev, data.url]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload échoué");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function addUrl(raw: string) {
    const u = raw.trim();
    if (!u) return;
    if (images.length >= MAX_IMAGES) {
      setError(`Maximum ${MAX_IMAGES} images.`);
      return;
    }
    setImages((prev) => [...prev, u]);
    setUrl("");
    setError("");
  }

  function move(i: number, dir: -1 | 1) {
    setImages((prev) => {
      const next = [...prev];
      const j = i + dir;
      if (j < 0 || j >= next.length) return prev;
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }

  return (
    <div className="space-y-2">
      <input type="hidden" name="images" value={JSON.stringify(images)} />

      <div className="grid grid-cols-4 gap-2">
        {images.map((img, i) => (
          <div
            key={i}
            className="relative aspect-square overflow-hidden rounded-md border bg-zinc-50 dark:bg-zinc-900"
          >
            <img src={img} alt={`Image ${i + 1}`} className="h-full w-full object-contain" />
            <span className="absolute left-1 top-1 rounded bg-black/60 px-1 text-[10px] text-white">
              {i + 1}
            </span>
            <div className="absolute inset-x-0 bottom-0 flex justify-between bg-black/60 p-0.5 text-white">
              <button
                type="button"
                onClick={() => move(i, -1)}
                disabled={i === 0}
                className="rounded px-1.5 text-xs hover:bg-white/20 disabled:opacity-30"
                aria-label="Monter"
              >
                ↑
              </button>
              <button
                type="button"
                onClick={() => move(i, 1)}
                disabled={i === images.length - 1}
                className="rounded px-1.5 text-xs hover:bg-white/20 disabled:opacity-30"
                aria-label="Descendre"
              >
                ↓
              </button>
              <button
                type="button"
                onClick={() => setImages((prev) => prev.filter((_, j) => j !== i))}
                className="rounded px-1.5 text-xs hover:bg-white/20"
                aria-label="Supprimer"
              >
                ✕
              </button>
            </div>
          </div>
        ))}
        {images.length < MAX_IMAGES && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
            className="flex aspect-square items-center justify-center rounded-md border border-dashed text-2xl text-muted-foreground hover:bg-accent disabled:opacity-50"
            aria-label="Uploader une image"
          >
            {busy ? "..." : "+"}
          </button>
        )}
      </div>

      <div className="flex gap-2">
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addUrl(url);
            }
          }}
          placeholder="Coller une URL d'image (https://...)"
          className={inputCls}
        />
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => addUrl(url)}
          disabled={images.length >= MAX_IMAGES}
        >
          Ajouter
        </Button>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void handleFile(f);
        }}
      />
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
