"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/rbac";
import { importProductsCsv, type ImportType } from "@/lib/products-import";

export type ImportState = {
  result?: { created: number; updated: number; failed: number; errors: { line: number; error: string }[] };
  error?: string;
} | undefined;

export async function importProductsAction(
  _prev: ImportState,
  formData: FormData,
): Promise<ImportState> {
  try {
    const user = await requirePermission("products.manage");
    if (!user.shopId) return { error: "Boutique introuvable." };

    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) {
      return { error: "Choisissez un fichier CSV." };
    }
    if (file.size > 2 * 1024 * 1024) {
      return { error: "Fichier trop volumineux (max 2 Mo)." };
    }

    const type = (String(formData.get("type") ?? "CREATION") as ImportType) ?? "CREATION";
    const csv = await file.text();
    const result = await importProductsCsv(user.shopId, csv, type, file.name);
    revalidatePath("/products");
    revalidatePath("/products/import");
    return { result };
  } catch (e) {
    console.error("importProductsAction:", e);
    return { error: "Erreur pendant l'import. Réessayez." };
  }
}
