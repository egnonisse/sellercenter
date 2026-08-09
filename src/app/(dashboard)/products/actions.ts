"use server";

import { revalidatePath } from "next/cache";
import { ZodError } from "zod";
import { requirePermission } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import {
  createProduct,
  updateProduct,
  submitProduct,
  delistProduct,
  requestProductDeletion,
} from "@/lib/products";
import { logProductHistory } from "@/lib/product-history";

export type ProductActionState = { error?: string } | undefined;

function parseForm(formData: FormData) {
  return {
    name: String(formData.get("name") ?? ""),
    description: String(formData.get("description") ?? ""),
    categoryId: String(formData.get("categoryId") ?? ""),
    brand: String(formData.get("brand") ?? ""),
    sku: String(formData.get("sku") ?? ""),
    ean: String(formData.get("ean") ?? ""),
    price: String(formData.get("price") ?? ""),
    compareAtPrice: String(formData.get("compareAtPrice") ?? ""),
    saleStartDate: String(formData.get("saleStartDate") ?? ""),
    saleEndDate: String(formData.get("saleEndDate") ?? ""),
    stockQty: String(formData.get("stockQty") ?? ""),
    color: String(formData.get("color") ?? ""),
    size: String(formData.get("size") ?? ""),
    warranty: String(formData.get("warranty") ?? ""),
    images: String(formData.get("images") ?? ""),
  };
}

function toInput(f: ReturnType<typeof parseForm>) {
  return {
    name: f.name,
    description: f.description,
    categoryId: f.categoryId,
    brand: f.brand,
    sku: f.sku,
    ean: f.ean,
    price: Number(f.price),
    compareAtPrice: f.compareAtPrice ? Number(f.compareAtPrice) : null,
    saleStartDate: f.saleStartDate,
    saleEndDate: f.saleEndDate,
    stockQty: Number(f.stockQty),
    attributes: { color: f.color, size: f.size, warranty: f.warranty },
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
    if (e.message === "PRODUIT_DELETION_PENDING") return "Produit en cours de suppression.";
  }
  console.error("productAction:", e);
  return "Erreur inattendue. Réessayez.";
}

export async function createProductAction(
  _prev: ProductActionState,
  formData: FormData,
): Promise<ProductActionState> {
  try {
    const user = await requirePermission("products.manage");
    if (!user.shopId) return { error: "Boutique introuvable." };
    const product = await createProduct(user.shopId, toInput(parseForm(formData)));
    await logProductHistory({ productId: product.id, action: "CREATED", actorUserId: user.id });
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
    const user = await requirePermission("products.manage");
    if (!user.shopId) return { error: "Boutique introuvable." };
    const updated = await updateProduct(user.shopId, productId, toInput(parseForm(formData)));
    await logProductHistory({
      productId,
      action: "UPDATED",
      from: updated.status,
      to: "DRAFT",
      actorUserId: user.id,
    });
    revalidatePath("/products");
    return {};
  } catch (e) {
    return { error: errorMessage(e) };
  }
}

export async function submitProductAction(productId: string) {
  try {
    const user = await requirePermission("products.manage");
    if (!user.shopId) return { error: "Boutique introuvable." };
    await submitProduct(user.shopId, productId);
    await logProductHistory({ productId, action: "SUBMITTED", to: "PENDING_QC", actorUserId: user.id });
    revalidatePath("/products");
    return {};
  } catch (e) {
    return { error: errorMessage(e) };
  }
}

export async function delistProductAction(productId: string) {
  try {
    const user = await requirePermission("products.manage");
    if (!user.shopId) return { error: "Boutique introuvable." };
    await delistProduct(user.shopId, productId);
    await logProductHistory({ productId, action: "DELISTED", to: "DELISTED", actorUserId: user.id });
    revalidatePath("/products");
    return {};
  } catch (e) {
    return { error: errorMessage(e) };
  }
}

// Retrait motivé (raison + commentaire) — appelé depuis le détail produit
export async function delistProductWithReasonAction(
  productId: string,
  _prev: ProductActionState,
  formData: FormData,
): Promise<ProductActionState> {
  try {
    const user = await requirePermission("products.manage");
    if (!user.shopId) return { error: "Boutique introuvable." };
    const reason = String(formData.get("reason") ?? "");
    const comment = String(formData.get("comment") ?? "");
    await delistProduct(user.shopId, productId, reason, comment);
    await logProductHistory({
      productId,
      action: "DELISTED",
      to: "DELISTED",
      note: `${reason}${comment ? ` — ${comment}` : ""}`,
      actorUserId: user.id,
    });
    revalidatePath(`/products/${productId}`);
    revalidatePath("/products");
    return {};
  } catch (e) {
    return { error: errorMessage(e) };
  }
}

// Demande de suppression (retention) : attend la confirmation admin
export async function requestDeletionAction(productId: string) {
  try {
    const user = await requirePermission("products.manage");
    if (!user.shopId) return { error: "Boutique introuvable." };
    await requestProductDeletion(user.shopId, productId);
    await logProductHistory({
      productId,
      action: "DELETION_REQUESTED",
      to: "DELETION_PENDING",
      actorUserId: user.id,
    });
    revalidatePath(`/products/${productId}`);
    revalidatePath("/products");
    return {};
  } catch (e) {
    return { error: errorMessage(e) };
  }
}

// Actions en masse : soumettre (DRAFT/REJECTED → PENDING_QC) ou retirer (ACTIVE → DELISTED)
export async function bulkProductsAction(formData: FormData): Promise<void> {
  try {
    const user = await requirePermission("products.manage");
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
        data: { status: "PENDING_QC", qcNote: null, qcReason: null },
      });
      await prisma.productHistory.createMany({
        data: ids.map((id) => ({
          productId: id,
          action: "SUBMITTED",
          to: "PENDING_QC",
          actorUserId: user.id,
        })),
      });
    } else if (action === "delist") {
      await prisma.product.updateMany({
        where: { id: { in: ids }, status: "ACTIVE" },
        data: { status: "DELISTED", syncStatus: "PENDING" },
      });
      await prisma.productHistory.createMany({
        data: ids.map((id) => ({
          productId: id,
          action: "DELISTED",
          to: "DELISTED",
          actorUserId: user.id,
        })),
      });
    } else {
      return;
    }

    revalidatePath("/products");
  } catch (e) {
    console.error("bulkProductsAction:", e);
  }
}
