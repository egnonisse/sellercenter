"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type CategoryOption = {
  id: string;
  name: string;
  children: { id: string; name: string }[];
};

type ProductInitial = {
  name: string;
  description: string | null;
  categoryId: string;
  brand: string | null;
  price: string;
  compareAtPrice: string | null;
  stockQty: number;
  images: unknown;
};

type FormAction = (
  prevState: { error?: string } | undefined,
  formData: FormData,
) => Promise<{ error?: string } | undefined>;

export function ProductForm({
  categories,
  action,
  initial,
  submitLabel = "Enregistrer",
}: {
  categories: CategoryOption[];
  action: FormAction;
  initial?: ProductInitial;
  submitLabel?: string;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);

  const imagesText = Array.isArray(initial?.images)
    ? (initial!.images as { url?: string }[]).map((i) => i.url ?? "").join("\n")
    : "";

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
          className="w-full rounded-md border border-zinc-200 bg-transparent px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:border-zinc-800"
          placeholder="Caractéristiques du produit..."
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="categoryId">Catégorie</Label>
          <select
            id="categoryId"
            name="categoryId"
            defaultValue={initial?.categoryId ?? ""}
            required
            className="w-full rounded-md border border-zinc-200 bg-transparent px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:border-zinc-800 dark:bg-zinc-950"
          >
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
          <Input id="brand" name="brand" defaultValue={initial?.brand ?? ""} placeholder="Ex : Samsung" />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="price">Prix (FCFA)</Label>
          <Input id="price" name="price" type="number" min="1" step="0.01" defaultValue={initial?.price} placeholder="75000" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="compareAtPrice">Ancien prix (optionnel)</Label>
          <Input id="compareAtPrice" name="compareAtPrice" type="number" min="1" step="0.01" defaultValue={initial?.compareAtPrice ?? ""} placeholder="85000" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="stockQty">Stock</Label>
          <Input id="stockQty" name="stockQty" type="number" min="0" step="1" defaultValue={initial?.stockQty ?? 0} required />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="images">Images (URLs, une par ligne — max 8)</Label>
        <textarea
          id="images"
          name="images"
          defaultValue={imagesText}
          rows={3}
          className="w-full rounded-md border border-zinc-200 bg-transparent px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:border-zinc-800"
          placeholder={"https://.../image1.jpg\nhttps://.../image2.jpg"}
        />
      </div>

      {state?.error && (
        <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p>
      )}

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
