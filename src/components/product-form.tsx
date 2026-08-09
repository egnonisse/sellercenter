"use client";

import { useActionState, useRef, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type CategoryOption = {
  id: string;
  name: string;
  children: { id: string; name: string }[];
};

type BrandOption = { id: string; name: string };

export type ProductInitial = {
  name: string;
  description: string | null;
  categoryId: string;
  brand: string | null;
  sku: string | null;
  ean: string | null;
  price: string;
  compareAtPrice: string | null;
  saleStartDate: string | null;
  saleEndDate: string | null;
  stockQty: number;
  images: unknown;
  attributes: { color?: string | null; size?: string | null; warranty?: string | null } | null;
};

type FormAction = (
  prevState: { error?: string } | undefined,
  formData: FormData,
) => Promise<{ error?: string } | undefined>;

const inputCls =
  "w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring dark:border-zinc-800 dark:bg-zinc-950";

function ImageUploader({ onUploaded }: { onUploaded: (url: string) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function handleFile(file: File) {
    setBusy(true);
    setError("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/products/image/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Upload échoué");
      onUploaded(data.url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload échoué");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="flex items-center gap-2">
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
      <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => inputRef.current?.click()}>
        {busy ? "Upload..." : "Uploader une image"}
      </Button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}

export function ProductForm({
  categories,
  brands,
  action,
  initial,
  submitLabel = "Enregistrer",
}: {
  categories: CategoryOption[];
  brands: BrandOption[];
  action: FormAction;
  initial?: ProductInitial;
  submitLabel?: string;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const [imagesText, setImagesText] = useState(
    Array.isArray(initial?.images)
      ? (initial!.images as { url?: string }[]).map((i) => i.url ?? "").join("\n")
      : "",
  );
  const attrs = initial?.attributes ?? {};

  return (
    <form action={formAction} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="name">Nom du produit</Label>
        <Input id="name" name="name" defaultValue={initial?.name} placeholder="Ex : Smart TV 43 pouces" required />
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <textarea
          id="description"
          name="description"
          defaultValue={initial?.description ?? ""}
          rows={4}
          className={inputCls}
          placeholder="Caractéristiques du produit..."
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="categoryId">Catégorie</Label>
          <select id="categoryId" name="categoryId" defaultValue={initial?.categoryId ?? ""} required className={inputCls}>
            <option value="" disabled>
              Choisir une catégorie
            </option>
            {categories.map((cat) => (
              <optgroup key={cat.id} label={cat.name}>
                {cat.children.length > 0 ? (
                  cat.children.map((child) => (
                    <option key={child.id} value={child.id}>
                      {child.name}
                    </option>
                  ))
                ) : (
                  <option value={cat.id}>{cat.name}</option>
                )}
              </optgroup>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="brand">Marque</Label>
          <Input id="brand" name="brand" list="brands-list" defaultValue={initial?.brand ?? ""} placeholder="Ex : Samsung" />
          <datalist id="brands-list">
            {brands.map((b) => (
              <option key={b.id} value={b.name} />
            ))}
          </datalist>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="sku">SKU du vendeur (optionnel)</Label>
          <Input id="sku" name="sku" defaultValue={initial?.sku ?? ""} placeholder="Ex : GLTV5" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="ean">EAN / GTIN (optionnel)</Label>
          <Input id="ean" name="ean" defaultValue={initial?.ean ?? ""} placeholder="Ex : 5901234123457" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="stockQty">Stock</Label>
          <Input id="stockQty" name="stockQty" type="number" min="0" step="1" defaultValue={initial?.stockQty ?? 0} required />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="price">Prix (FCFA)</Label>
          <Input id="price" name="price" type="number" min="1" step="0.01" defaultValue={initial?.price} placeholder="75000" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="compareAtPrice">Ancien prix — promo (optionnel)</Label>
          <Input id="compareAtPrice" name="compareAtPrice" type="number" min="1" step="0.01" defaultValue={initial?.compareAtPrice ?? ""} placeholder="85000" />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="saleStartDate">Début de la promo (optionnel)</Label>
          <Input
            id="saleStartDate"
            name="saleStartDate"
            type="date"
            defaultValue={initial?.saleStartDate ? initial.saleStartDate.slice(0, 10) : ""}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="saleEndDate">Fin de la promo (optionnel)</Label>
          <Input
            id="saleEndDate"
            name="saleEndDate"
            type="date"
            defaultValue={initial?.saleEndDate ? initial.saleEndDate.slice(0, 10) : ""}
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="attr-color">Couleur (optionnel)</Label>
          <Input id="attr-color" name="color" defaultValue={attrs.color ?? ""} placeholder="Noir" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="attr-size">Taille (optionnel)</Label>
          <Input id="attr-size" name="size" defaultValue={attrs.size ?? ""} placeholder="43 pouces" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="attr-warranty">Garantie (optionnel)</Label>
          <Input id="attr-warranty" name="warranty" defaultValue={attrs.warranty ?? ""} placeholder="12 mois" />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="images">Images (URLs, une par ligne — max 8)</Label>
        <textarea
          id="images"
          name="images"
          value={imagesText}
          onChange={(e) => setImagesText(e.target.value)}
          rows={3}
          className={inputCls}
          placeholder={"https://.../image1.jpg\nhttps://.../image2.jpg"}
        />
        <ImageUploader
          onUploaded={(url) => setImagesText((prev) => (prev ? `${prev}\n${url}` : url))}
        />
      </div>

      {state?.error && <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p>}

      <div className="flex gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Enregistrement..." : submitLabel}
        </Button>
        <Link href="/products">
          <Button type="button" variant="outline">
            Annuler
          </Button>
        </Link>
      </div>
    </form>
  );
}
