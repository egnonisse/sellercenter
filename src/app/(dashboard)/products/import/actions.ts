"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/require-role";
import { importProductsCsv } from "@/lib/products-import";

export type ImportState = {
  result?: { created: number; updated: number; errors: { line: number; error: string }[] };
  error?: string;
} | undefined;

export async function importProductsAction(
  _prev: ImportState,
  formData: FormData,
): Promise<ImportState> {
  try {
    const user = await requireRole(["SHOP_ADMIN", "SHOP_MANAGER"]);
    if (!user.shopId) return { error: "Boutique introuvable." };

    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) {
      return { error: "Choisissez un fichier CSV." };
    }
    if (file.size > 2 * 1024 * 1024) {
      return { error: "Fichier trop volumineux (max 2 Mo)." };
    }

    const csv = await file.text();
    const result = await importProductsCsv(user.shopId, csv);
    revalidatePath("/products");
    return { result };
  } catch (e) {
    console.error("importProductsAction:", e);
    return { error: "Erreur pendant l'import. Réessayez." };
  }
}
