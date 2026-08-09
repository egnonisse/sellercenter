"use server";

import { revalidatePath } from "next/cache";
import { ZodError } from "zod";
import { requireRole } from "@/lib/require-role";
import { prisma } from "@/lib/prisma";
import {
  createProduct,
  updateProduct,
  submitProduct,
  delistProduct,
} from "@/lib/products";

export type ProductActionState = { error?: string } | undefined;

function parseForm(formData: FormData) {
  return {
    name: String(formData.get("name") ?? ""),
    description: String(formData.get("description") ?? ""),
    categoryId: String(formData.get("categoryId") ?? ""),
    brand: String(formData.get("brand") ?? ""),
    price: String(formData.get("price") ?? ""),
    compareAtPrice: String(formData.get("compareAtPrice") ?? ""),
    stockQty: String(formData.get("stockQty") ?? ""),
    images: String(formData.get("images") ?? ""),
  };
}

function toInput(f: ReturnType<typeof parseForm>) {
  return {
    name: f.name,
    description: f.description,
    categoryId: f.categoryId,
    brand: f.brand,
    price: Number(f.price),
    compareAtPrice: f.compareAtPrice ? Number(f.compareAtPrice) : null,
    stockQty: Number(f.stockQty),
    images: f.images
      .split(/[\n,]/)
      .map((s) => s.trim())
      .filter(Boolean),
  };
}

function errorMessage(e: unknown): string {
  if (e instanceof ZodError) return e.issues[0]?.message ?? "Formulaire invalide.";
  if (e instanceof Error) {
    if (e.message === "PRODUIT_INTROUVABLE") return "Produit introuvable.";
  }
  console.error("productAction:", e);
  return "Erreur inattendue. Réessayez.";
}

export async function createProductAction(
  _prev: ProductActionState,
  formData: FormData,
): Promise<ProductActionState> {
  try {
    const user = await requireRole(["SHOP_ADMIN", "SHOP_MANAGER"]);
    if (!user.shopId) return { error: "Boutique introuvable." };
    await createProduct(user.shopId, toInput(parseForm(formData)));
    revalidatePath("/products");
    return {};
  } catch (e) {
    return { error: errorMessage(e) };
  }
}

export async function updateProductAction(
  productId: string,
  _prev: ProductActionState,
  formData: FormData,
): Promise<ProductActionState> {
  try {
    const user = await requireRole(["SHOP_ADMIN", "SHOP_MANAGER"]);
    if (!user.shopId) return { error: "Boutique introuvable." };
    await updateProduct(user.shopId, productId, toInput(parseForm(formData)));
    revalidatePath("/products");
    return {};
  } catch (e) {
    return { error: errorMessage(e) };
  }
}

export async function submitProductAction(productId: string) {
  try {
    const user = await requireRole(["SHOP_ADMIN", "SHOP_MANAGER"]);
    if (!user.shopId) return { error: "Boutique introuvable." };
    await submitProduct(user.shopId, productId);
    revalidatePath("/products");
    return {};
  } catch (e) {
    return { error: errorMessage(e) };
  }
}

export async function delistProductAction(productId: string) {
  try {
    const user = await requireRole(["SHOP_ADMIN", "SHOP_MANAGER"]);
    if (!user.shopId) return { error: "Boutique introuvable." };
    await delistProduct(user.shopId, productId);
    revalidatePath("/products");
    return {};
  } catch (e) {
    return { error: errorMessage(e) };
  }
}

// Actions en masse : soumettre (DRAFT/REJECTED → PENDING_QC) ou retirer (ACTIVE → DELISTED)
export async function bulkProductsAction(formData: FormData): Promise<void> {
  try {
    const user = await requireRole(["SHOP_ADMIN", "SHOP_MANAGER"]);
    if (!user.shopId) return;

    const ids = formData.getAll("ids").map(String);
    const action = String(formData.get("bulkAction") ?? "");
    if (ids.length === 0) return;

    const owned = await prisma.product.count({
      where: { id: { in: ids }, shopId: user.shopId },
    });
    if (owned !== ids.length) return;

    if (action === "submit") {
      await prisma.product.updateMany({
        where: { id: { in: ids }, status: { in: ["DRAFT", "REJECTED"] } },
        data: { status: "PENDING_QC", qcNote: null },
      });
    } else if (action === "delist") {
      await prisma.product.updateMany({
        where: { id: { in: ids }, status: "ACTIVE" },
        data: { status: "DELISTED", syncStatus: "PENDING" },
      });
    } else {
      return;
    }

    revalidatePath("/products");
  } catch (e) {
    console.error("bulkProductsAction:", e);
  }
}
